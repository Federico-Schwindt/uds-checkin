import { eq } from "drizzle-orm";
import { getDb, settings } from "@/db";
import type { FormSchema } from "@/lib/form-schema";
import {
  DEFAULT_TIMEZONE,
  DEFAULT_WORK_HOURS,
  normalizeWorkHours,
  type DaySchedule,
} from "@/lib/work-hours";
import { DEFAULT_SCORING, normalizeScoring, type ScoringConfig } from "@/lib/performance-config";

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
  /** IANA timezone the posted opening hours are expressed in. */
  timezone: string;
  workHours: DaySchedule[];
  earlyLoginMinutes: number;
  lateLoginMinutes: number;
  shiftSessionGraceMinutes: number;
  scoring: ScoringConfig;
};

/** Everything the schedule + scoring code needs, normalized and safe to use. */
export type ShopConfig = {
  timezone: string;
  workHours: DaySchedule[];
  earlyLoginMinutes: number;
  lateLoginMinutes: number;
  shiftSessionGraceMinutes: number;
  scoring: ScoringConfig;
};

export function toShopConfig(s: Partial<AppSettings>): ShopConfig {
  const int = (v: unknown, fallback: number) => {
    const n = Number(v);
    return isNaN(n) ? fallback : Math.max(0, Math.round(n));
  };
  return {
    timezone: typeof s.timezone === "string" && s.timezone ? s.timezone : DEFAULT_TIMEZONE,
    workHours: normalizeWorkHours(s.workHours ?? DEFAULT_WORK_HOURS),
    earlyLoginMinutes: int(s.earlyLoginMinutes, 30),
    lateLoginMinutes: int(s.lateLoginMinutes, 60),
    shiftSessionGraceMinutes: int(s.shiftSessionGraceMinutes, 60),
    scoring: normalizeScoring(s.scoring ?? DEFAULT_SCORING),
  };
}

export async function getShopConfig(): Promise<ShopConfig> {
  return toShopConfig(await getSettings());
}

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
