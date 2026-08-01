import { eq } from "drizzle-orm";
import { getDb, settings } from "@/db";
import type { FormSchema } from "@/lib/form-schema";

export type KioskColumn = { key: string; visible: boolean };

export type AppSettings = {
  kioskColumns: KioskColumn[];
  logoUrl: string;
  brandColor: string;
  googleMapsKey: string;
  /** Legacy simple layout, superseded by formSchema. Kept so old stored values load. */
  formLayout: unknown;
  formSchema: FormSchema | null;
  fieldOptions: Record<string, string[]> | null;
  pin: string;
  idleLockMinutes: number;
  sessionDays: number;
  businessName: string;
  adminEmail: string;
  turnaroundBanner: string;
  helpPhone: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFrom: string;
  twilioMessagingServiceSid: string;
  smsEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFromName: string;
  smtpFromEmail: string;
  emailEnabled: boolean;
  adminNotifyEnabled: boolean;
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.select().from(settings);
  const map: Record<string, unknown> = {};
  for (const r of rows) map[r.key] = r.value;
  return map as unknown as AppSettings;
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const all = await getSettings();
  return all[key];
}

export async function setSettings(values: Partial<AppSettings>): Promise<void> {
  const db = await getDb();
  for (const [key, value] of Object.entries(values)) {
    const existing = await db.select().from(settings).where(eq(settings.key, key));
    if (existing.length) {
      await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
      await db.insert(settings).values({ key, value });
    }
  }
}

/** Settings safe to expose to the admin UI (secrets masked). */
export function maskSecrets(s: AppSettings): AppSettings {
  return {
    ...s,
    twilioAuthToken: s.twilioAuthToken ? "••••••••" : "",
    smtpPass: s.smtpPass ? "••••••••" : "",
  };
}
