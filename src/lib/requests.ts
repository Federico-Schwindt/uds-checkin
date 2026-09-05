import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb, requestMessages, requests, users } from "@/db";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/notify";
import { formatDateKey } from "@/lib/work-hours";
import { REQUEST_TYPE_LABEL } from "@/lib/request-types";

export * from "@/lib/request-types";

/** Short, unambiguous token that rides in the email subject: `UDS-4F2K9A`. */
export function newRequestToken(): string {
  return `UDS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Finds the request token inside an email subject line. */
export function tokenFromSubject(subject: string): string | null {
  const m = /\bUDS-[0-9A-F]{8}\b/i.exec(subject || "");
  return m ? m[0].toUpperCase() : null;
}

/**
 * Trims a reply down to what the person actually typed. Mail clients quote the
 * whole thread underneath; keeping it would make every message unreadable.
 */
export function stripQuotedReply(text: string): string {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    // Common reply separators across Gmail, Outlook, Apple Mail and Hostinger webmail.
    if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(t)) break;
    if (/^_{5,}$/.test(t)) break;
    if (/^On .+ wrote:$/i.test(t)) break;
    if (/^El .+ escribió:$/i.test(t)) break;
    if (/^From:\s/i.test(t) && out.length) break;
    if (/^>{1,}/.test(t)) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

export type RequestRow = typeof requests.$inferSelect;

/** Emails the shop manager about a request, with the token that threads replies. */
export async function emailRequest(
  request: RequestRow,
  author: { name: string; role: string },
  body: string,
  opts: { isNew?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  const s = await getSettings();
  if (!s.requestsEmailEnabled || !s.requestsEmail) return { ok: false, error: "Request emails are disabled" };

  const window = request.requestedDate
    ? `\nDate requested: ${formatDateKey(request.requestedDate, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${
        request.requestedEndDate ? ` → ${formatDateKey(request.requestedEndDate, { month: "long", day: "numeric" })}` : ""
      }`
    : "";

  const header = opts.isNew
    ? `${author.name} submitted a new request.`
    : `${author.name} added a message to an existing request.`;

  const text =
    `${header}\n\n` +
    `Type: ${REQUEST_TYPE_LABEL[request.type] || request.type}\n` +
    `Subject: ${request.subject}${window}\n\n` +
    `${body}\n\n` +
    `— Reply to this email and your answer appears in the app for ${author.role === "admin" ? "the team" : author.name}. ` +
    `Keep ${request.token} in the subject line so it reaches the right request.`;

  return sendEmail({
    to: s.requestsEmail,
    subject: `[${request.token}] ${REQUEST_TYPE_LABEL[request.type] || "Request"} — ${request.subject}`,
    body: text,
    templateKey: "staff_request",
    settings: s,
    replyTo: s.smtpFromEmail || s.smtpUser,
  });
}

/** Appends a message and keeps the thread's unread flags and timestamps right. */
export async function addRequestMessage(opts: {
  requestId: number;
  authorRole: "tech" | "admin";
  authorName: string;
  body: string;
  viaEmail?: boolean;
  externalId?: string;
}) {
  const db = await getDb();
  const [message] = await db
    .insert(requestMessages)
    .values({
      requestId: opts.requestId,
      authorRole: opts.authorRole,
      authorName: opts.authorName,
      body: opts.body,
      viaEmail: !!opts.viaEmail,
      externalId: opts.externalId || "",
    })
    .returning();

  await db
    .update(requests)
    .set({
      lastMessageAt: new Date(),
      updatedAt: new Date(),
      // The side that did not write is the side that has something to read.
      unreadForAdmin: opts.authorRole === "tech",
      unreadForUser: opts.authorRole === "admin",
    })
    .where(eq(requests.id, opts.requestId));

  return message;
}

/** One thread with its author and messages, oldest message first. */
export async function loadRequest(id: number) {
  const db = await getDb();
  const rows = await db
    .select({
      request: requests,
      userName: users.name,
      userTitle: users.title,
      userId: users.id,
    })
    .from(requests)
    .leftJoin(users, eq(requests.userId, users.id))
    .where(eq(requests.id, id));
  if (!rows.length) return null;
  const messages = await db
    .select()
    .from(requestMessages)
    .where(eq(requestMessages.requestId, id))
    .orderBy(requestMessages.createdAt);
  return { ...rows[0], messages };
}

/** Threads for the admin inbox, or one technician's own list. */
export async function listRequests(opts: { userId?: number; status?: string } = {}) {
  const db = await getDb();
  const conds = [];
  if (opts.userId) conds.push(eq(requests.userId, opts.userId));
  if (opts.status) conds.push(eq(requests.status, opts.status));
  return db
    .select({
      request: requests,
      userName: users.name,
      userTitle: users.title,
    })
    .from(requests)
    .leftJoin(users, eq(requests.userId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(requests.lastMessageAt));
}
