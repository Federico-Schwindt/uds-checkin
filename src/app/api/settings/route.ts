import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSettings, maskSecrets, type AppSettings } from "@/lib/settings";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ settings: maskSecrets(s) });
}

const ALLOWED_KEYS: Array<keyof AppSettings> = [
  "pin", "idleLockMinutes", "sessionDays", "businessName", "adminEmail",
  "turnaroundBanner", "helpPhone",
  "twilioAccountSid", "twilioAuthToken", "twilioFrom", "twilioMessagingServiceSid", "smsEnabled",
  "smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPass", "smtpFromName", "smtpFromEmail", "emailEnabled",
  "adminNotifyEnabled", "kioskColumns", "logoUrl", "brandColor", "formLayout", "fieldOptions",
];

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const patch: Partial<AppSettings> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in body) {
      const v = body[key];
      // Masked secrets come back unchanged from the UI — don't overwrite with the mask.
      if ((key === "twilioAuthToken" || key === "smtpPass") && typeof v === "string" && v.includes("••")) continue;
      (patch as Record<string, unknown>)[key] = v;
    }
  }
  if (typeof patch.pin === "string" && patch.pin.length > 0 && !/^\d{4,10}$/.test(patch.pin)) {
    return NextResponse.json({ error: "PIN must be 4-10 digits" }, { status: 400 });
  }
  if ("pin" in patch && !patch.pin) delete patch.pin;

  await setSettings(patch);
  const s = await getSettings();
  return NextResponse.json({ settings: maskSecrets(s) });
}
