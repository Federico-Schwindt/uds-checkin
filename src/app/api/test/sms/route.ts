import { NextRequest, NextResponse } from "next/server";
import { sendSms } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const { to, body } = await req.json().catch(() => ({}));
  if (!to) return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  const result = await sendSms({
    to,
    body: body || "Test SMS from UDS Check-In. Twilio is configured correctly!",
    templateKey: "test",
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
