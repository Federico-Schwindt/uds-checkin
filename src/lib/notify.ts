import { eq } from "drizzle-orm";
import { getDb, entries, customers, messageTemplates, messageLog } from "@/db";
import { getSettings, type AppSettings } from "@/lib/settings";
import { formatMoney, formatPhone, toE164 } from "@/lib/utils";

export type TemplateKey = "submission" | "confirmed" | "ongoing" | "on_hold" | "completed" | "admin_submission";

export const STATUS_TO_KEY: Record<string, TemplateKey> = {
  Confirmed: "confirmed",
  Ongoing: "ongoing",
  "On hold": "on_hold",
  Completed: "completed",
};

export const TEMPLATE_VARIABLES = [
  "{first_name}",
  "{last_name}",
  "{full_name}",
  "{phone}",
  "{company_name}",
  "{company_phone}",
  "{email}",
  "{job_number}",
  "{status}",
  "{on_hold_reason}",
  "{assigned_employee}",
  "{eta}",
  "{vehicle}",
  "{deposit}",
  "{total}",
  "{business_name}",
] as const;

export type EntryWithCustomer = typeof entries.$inferSelect & {
  customer: typeof customers.$inferSelect | null;
};

export function buildVariables(entry: EntryWithCustomer, s: AppSettings): Record<string, string> {
  const c = entry.customer;
  const vehicle = [entry.vehicleYear, entry.vehicleMake, entry.vehicleModel].filter(Boolean).join(" ");
  return {
    first_name: c?.firstName || "customer",
    last_name: c?.lastName || "",
    full_name: [c?.firstName, c?.lastName].filter(Boolean).join(" ") || "customer",
    phone: formatPhone(c?.phone || ""),
    company_name: c?.companyName || "",
    company_phone: formatPhone(c?.companyPhone || ""),
    email: c?.email || "",
    job_number: entry.jobNumber || String(entry.id),
    status: entry.jobStatus || "",
    on_hold_reason: entry.onHoldReason || "",
    assigned_employee: entry.assignedEmployee || entry.employeeName || "our team",
    eta: entry.etaJob || "",
    vehicle: vehicle || "your vehicle",
    deposit: formatMoney(entry.deposit),
    total: formatMoney(entry.total),
    business_name: s.businessName || "Universal Driveshafts",
  };
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m));
}

async function logMessage(entry: {
  entryId: number | null;
  channel: string;
  recipient: string;
  templateKey: string;
  subject: string;
  body: string;
  status: string;
  providerId?: string;
  error?: string;
}) {
  const db = await getDb();
  await db.insert(messageLog).values({
    entryId: entry.entryId,
    channel: entry.channel,
    recipient: entry.recipient,
    templateKey: entry.templateKey,
    subject: entry.subject,
    body: entry.body,
    status: entry.status,
    providerId: entry.providerId || "",
    error: entry.error || "",
  });
}

export async function sendSms(opts: {
  to: string;
  body: string;
  entryId?: number | null;
  templateKey?: string;
  settings?: AppSettings;
}): Promise<{ ok: boolean; error?: string }> {
  const s = opts.settings || (await getSettings());
  const to = toE164(opts.to);
  const base = {
    entryId: opts.entryId ?? null,
    channel: "sms",
    recipient: to,
    templateKey: opts.templateKey || "",
    subject: "",
    body: opts.body,
  };
  if (!s.smsEnabled) {
    await logMessage({ ...base, status: "failed", error: "SMS sending is disabled in settings" });
    return { ok: false, error: "SMS sending is disabled in settings" };
  }
  if (!s.twilioAccountSid || !s.twilioAuthToken || (!s.twilioFrom && !s.twilioMessagingServiceSid)) {
    await logMessage({ ...base, status: "failed", error: "Twilio is not configured" });
    return { ok: false, error: "Twilio is not configured" };
  }
  if (!to) {
    await logMessage({ ...base, status: "failed", error: "No valid phone number" });
    return { ok: false, error: "No valid phone number" };
  }
  try {
    const { default: twilio } = await import("twilio");
    const client = twilio(s.twilioAccountSid, s.twilioAuthToken);
    const msg = await client.messages.create({
      to,
      body: opts.body,
      ...(s.twilioMessagingServiceSid
        ? { messagingServiceSid: s.twilioMessagingServiceSid }
        : { from: s.twilioFrom }),
    });
    await logMessage({ ...base, status: "sent", providerId: msg.sid });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logMessage({ ...base, status: "failed", error });
    return { ok: false, error };
  }
}

/** Branded HTML email wrapper: logo header, brand-colored bar, plain body, footer. */
export function renderBrandedEmail(body: string, s: AppSettings): string {
  const brand = s.brandColor || "#1246ab";
  const name = s.businessName || "Universal Driveshafts";
  const logo = s.logoUrl
    ? `<img src="${s.logoUrl}" alt="${name}" style="max-height:44px;max-width:260px;display:block;" />`
    : `<span style="font-size:22px;font-weight:800;color:${brand};letter-spacing:0.5px;">${name}</span>`;
  const paragraphs = body
    .split("\n")
    .map((l) => (l.trim() ? `<p style="margin:0 0 6px;line-height:1.55;">${l}</p>` : `<br/>`))
    .join("");
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef1f6;font-family:'Poppins',Arial,Helvetica,sans-serif;color:#131b2b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e0e5ee;">
          <tr>
            <td style="background:#ffffff;padding:22px 28px;" align="left">${logo}</td>
          </tr>
          <tr><td style="background:${brand};height:5px;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:28px;font-size:15px;color:#333d52;">${paragraphs}</td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f6f8fb;border-top:1px solid #e0e5ee;font-size:12px;color:#647085;">
              <strong style="color:#131b2b;">${name}</strong>${s.helpPhone ? ` · ${s.helpPhone}` : ""}<br/>
              You are receiving this email because of a service order with us.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  entryId?: number | null;
  templateKey?: string;
  settings?: AppSettings;
  /** Where replies should go — used to route staff-request replies back in. */
  replyTo?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const s = opts.settings || (await getSettings());
  const base = {
    entryId: opts.entryId ?? null,
    channel: "email",
    recipient: opts.to,
    templateKey: opts.templateKey || "",
    subject: opts.subject,
    body: opts.body,
  };
  if (!s.emailEnabled) {
    await logMessage({ ...base, status: "failed", error: "Email sending is disabled in settings" });
    return { ok: false, error: "Email sending is disabled in settings" };
  }
  if (!s.smtpHost || !s.smtpUser || !s.smtpPass) {
    await logMessage({ ...base, status: "failed", error: "SMTP is not configured" });
    return { ok: false, error: "SMTP is not configured" };
  }
  if (!opts.to) {
    await logMessage({ ...base, status: "failed", error: "No recipient email" });
    return { ok: false, error: "No recipient email" };
  }
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: s.smtpHost,
      port: s.smtpPort || 465,
      secure: s.smtpSecure !== false,
      auth: { user: s.smtpUser, pass: s.smtpPass },
    });
    const info = await transport.sendMail({
      from: `"${s.smtpFromName || s.businessName}" <${s.smtpFromEmail || s.smtpUser}>`,
      to: opts.to,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      subject: opts.subject,
      text: opts.body,
      html: renderBrandedEmail(opts.body, s),
    });
    await logMessage({ ...base, status: "sent", providerId: info.messageId || "" });
    return { ok: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logMessage({ ...base, status: "failed", error });
    return { ok: false, error };
  }
}

async function loadEntryWithCustomer(entryId: number): Promise<EntryWithCustomer | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(eq(entries.id, entryId));
  if (!rows.length) return null;
  return { ...rows[0].entries, customer: rows[0].customers };
}

/**
 * Fire all enabled templates for a given event key against an entry.
 * SMS goes to the customer only when they gave consent.
 */
export async function notifyForEntry(entryId: number, key: TemplateKey): Promise<{ sms?: boolean; email?: boolean }> {
  const db = await getDb();
  const entry = await loadEntryWithCustomer(entryId);
  if (!entry) return {};
  const s = await getSettings();
  const vars = buildVariables(entry, s);
  const templates = await db.select().from(messageTemplates).where(eq(messageTemplates.key, key));
  const result: { sms?: boolean; email?: boolean } = {};

  for (const t of templates) {
    if (!t.enabled) continue;
    const body = renderTemplate(t.body, vars);
    const subject = renderTemplate(t.subject, vars);
    if (t.channel === "sms") {
      if (!entry.customer?.smsConsent) continue;
      const r = await sendSms({ to: entry.customer?.phone || "", body, entryId, templateKey: key, settings: s });
      result.sms = r.ok;
    } else if (t.channel === "email") {
      const to = key === "admin_submission" ? s.adminEmail : entry.customer?.email || "";
      if (!to) continue;
      const r = await sendEmail({ to, subject, body, entryId, templateKey: key, settings: s });
      result.email = r.ok;
    }
  }
  return result;
}

/** Notify on a status change; assumes the caller verified the status actually changed. */
export async function notifyStatusChange(entryId: number, newStatus: string) {
  const key = STATUS_TO_KEY[newStatus];
  if (!key) return {};
  return notifyForEntry(entryId, key);
}
