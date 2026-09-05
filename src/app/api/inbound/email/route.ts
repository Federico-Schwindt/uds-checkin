import { NextRequest, NextResponse } from "next/server";
import { applyInboundEmail } from "@/lib/inbound-mail";

/**
 * Webhook for an inbound-email provider (Mailgun, SendGrid, Postmark, …) as an
 * alternative to IMAP polling. Shared-secret protected because it is public.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) return NextResponse.json({ error: "Inbound email is not configured" }, { status: 404 });
  const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-inbound-secret");
  if (provided !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") || "";
  let payload: Record<string, unknown> = {};
  if (contentType.includes("application/json")) {
    payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  } else {
    const form = await req.formData().catch(() => null);
    if (form) payload = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  }

  // Field names differ per provider; accept the common spellings.
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = payload[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  };

  const result = await applyInboundEmail({
    from: pick("from", "From", "sender", "FromFull"),
    subject: pick("subject", "Subject"),
    text: pick("text", "TextBody", "body-plain", "stripped-text", "plain"),
    messageId: pick("messageId", "Message-Id", "MessageID", "message-id"),
  });

  // Always 200 so the provider does not retry a message we deliberately ignored.
  return NextResponse.json(result);
}
