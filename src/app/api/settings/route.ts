import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSettings, maskSecrets, type AppSettings } from "@/lib/settings";
import { logActivity } from "@/lib/audit";
import { normalizeWorkHours } from "@/lib/work-hours";
import { normalizeScoring } from "@/lib/performance-config";
import { sessionFromRequest } from "@/lib/session";
import { actorLabel } from "@/lib/auth";

/** Human labels for what changed, keeping secret values out of the log. */
const SECRET_KEYS = new Set(["twilioAuthToken", "smtpPass"]);

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ settings: maskSecrets(s) });
}

const ALLOWED_KEYS: Array<keyof AppSettings> = [
  "idleLockMinutes", "sessionDays", "businessName", "adminEmail",
  "turnaroundBanner", "helpPhone",
  "twilioAccountSid", "twilioAuthToken", "twilioFrom", "twilioMessagingServiceSid", "smsEnabled",
  "smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpPass", "smtpFromName", "smtpFromEmail", "emailEnabled",
  "adminNotifyEnabled", "kioskColumns", "logoUrl", "brandColor", "googleMapsKey", "formLayout", "formSchema", "fieldOptions",
  "timezone", "workHours", "earlyLoginMinutes", "lateLoginMinutes", "shiftSessionGraceMinutes", "scoring",
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
  // Normalize the schedule / scoring blobs so a bad payload can never lock anyone out.
  if ("workHours" in patch) patch.workHours = normalizeWorkHours(patch.workHours);
  if ("scoring" in patch) patch.scoring = normalizeScoring(patch.scoring);

  await setSettings(patch);

  const changedKeys = Object.keys(patch);
  if (changedKeys.length) {
    // Special-case the big config objects so the log reads clearly.
    let summary: string;
    if (changedKeys.includes("workHours")) summary = "Updated the working hours schedule";
    else if (changedKeys.includes("scoring")) summary = "Updated the performance scoring rules";
    else if (changedKeys.includes("formSchema")) summary = "Updated the check-in form (Form Builder)";
    else if (changedKeys.includes("fieldOptions")) summary = "Updated form dropdown options";
    else if (changedKeys.includes("kioskColumns")) summary = "Updated kiosk table columns";
    else summary = `Updated settings: ${changedKeys.join(", ")}`;
    await logActivity({
      action: "settings.update",
      entity: "settings",
      summary,
      details: Object.fromEntries(changedKeys.map((k) => [k, SECRET_KEYS.has(k) ? "••••" : (patch as Record<string, unknown>)[k]])),
      actor: actorLabel(sessionFromRequest(req)),
      req,
    });
  }

  const s = await getSettings();
  return NextResponse.json({ settings: maskSecrets(s) });
}
