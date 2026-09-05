import { and, eq } from "drizzle-orm";
import { getDb, requestMessages, requests, users } from "@/db";
import { getSettings } from "@/lib/settings";
import { addRequestMessage, stripQuotedReply, tokenFromSubject } from "@/lib/requests";

export type ImportResult = {
  checked: number;
  imported: number;
  skipped: string[];
  error?: string;
};

/**
 * Only the shop's own people may answer by email. Without this check anyone who
 * learned a request token could post into a staff thread.
 */
async function allowedSenders(): Promise<Set<string>> {
  const s = await getSettings();
  const db = await getDb();
  const admins = await db.select({ email: users.email }).from(users).where(eq(users.role, "admin"));
  return new Set(
    [s.requestsEmail, s.adminEmail, s.smtpUser, s.smtpFromEmail, ...admins.map((a) => a.email)]
      .filter(Boolean)
      .map((e) => String(e).trim().toLowerCase())
  );
}

/** Applies one already-parsed email to its request thread. */
export async function applyInboundEmail(mail: {
  from: string;
  subject: string;
  text: string;
  messageId?: string;
}): Promise<{ ok: boolean; reason?: string; requestId?: number }> {
  const token = tokenFromSubject(mail.subject);
  if (!token) return { ok: false, reason: "no request token in the subject" };

  const from = (mail.from || "").toLowerCase();
  const allowed = await allowedSenders();
  const match = [...allowed].some((a) => from.includes(a));
  if (!match) return { ok: false, reason: `sender ${mail.from} is not an allowed replier` };

  const db = await getDb();
  const [request] = await db.select().from(requests).where(eq(requests.token, token));
  if (!request) return { ok: false, reason: `no request for token ${token}` };

  // Re-running the poller must not duplicate a reply.
  if (mail.messageId) {
    const seen = await db
      .select({ id: requestMessages.id })
      .from(requestMessages)
      .where(and(eq(requestMessages.requestId, request.id), eq(requestMessages.externalId, mail.messageId)));
    if (seen.length) return { ok: false, reason: "already imported" };
  }

  const body = stripQuotedReply(mail.text);
  if (!body) return { ok: false, reason: "empty reply body" };

  await addRequestMessage({
    requestId: request.id,
    authorRole: "admin",
    authorName: senderName(mail.from),
    body,
    viaEmail: true,
    externalId: mail.messageId || "",
  });
  return { ok: true, requestId: request.id };
}

function senderName(from: string): string {
  const named = /^\s*"?([^"<]+?)"?\s*</.exec(from || "");
  if (named) return named[1].trim();
  const addr = /([^\s<>]+@[^\s<>]+)/.exec(from || "");
  return addr ? addr[1] : "Shop manager";
}

/**
 * Pulls unread replies out of the shop mailbox over IMAP. Called from the admin
 * panel button and from a scheduled job; safe to run as often as you like.
 */
export async function pollMailbox(): Promise<ImportResult> {
  const s = await getSettings();
  const result: ImportResult = { checked: 0, imported: 0, skipped: [] };

  if (!s.imapEnabled) return { ...result, error: "Reply collection is turned off in Settings" };
  const host = s.imapHost || "imap.hostinger.com";
  const user = s.imapUser || s.smtpUser;
  const pass = s.imapPass || s.smtpPass;
  if (!host || !user || !pass) return { ...result, error: "The reply mailbox is not configured" };

  const { ImapFlow } = await import("imapflow");
  const { simpleParser } = await import("mailparser");

  const client = new ImapFlow({
    host,
    port: Number(s.imapPort) || 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Unseen mail only — anything already read has been handled or isn't ours.
      const uids = await client.search({ seen: false });
      const recent = (uids || []).slice(-50);
      for (const uid of recent) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        result.checked++;
        const parsed = await simpleParser(msg.source);
        const outcome = await applyInboundEmail({
          from: parsed.from?.text || "",
          subject: parsed.subject || "",
          text: parsed.text || "",
          messageId: parsed.messageId || "",
        });
        if (outcome.ok) {
          result.imported++;
          // Mark it read so the next poll skips it.
          await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        } else if (outcome.reason && outcome.reason !== "no request token in the subject") {
          result.skipped.push(`${parsed.subject || "(no subject)"} — ${outcome.reason}`);
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await client.close();
    } catch {
      // The connection is already gone; nothing to clean up.
    }
    return { ...result, error: message };
  }

  return result;
}
