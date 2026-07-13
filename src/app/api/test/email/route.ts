import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const { to } = await req.json().catch(() => ({}));
  if (!to) return NextResponse.json({ error: "Email address required" }, { status: 400 });
  const result = await sendEmail({
    to,
    subject: "Test email from UDS Check-In",
    body: "This is a test email from UDS Check-In.\n\nYour SMTP settings are configured correctly!",
    templateKey: "test",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
