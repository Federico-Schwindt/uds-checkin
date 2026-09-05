import { and, eq, sql } from "drizzle-orm";
import { getDb, attendance } from "@/db";
import type { ShopConfig } from "@/lib/settings";
import { formatHhMm, parseHhMm, scheduleForDay, shopTime } from "@/lib/work-hours";

export type ArrivalResult = {
  /** True when this was the first sign-in of the day — the arrival that gets logged. */
  first: boolean;
  dateKey: string;
  arrivalMinutes: number;
  minutesLate: number;
  late: boolean;
  scheduledStart: string;
};

/**
 * Records the sign-in. The first one of each shop-local day is the arrival time
 * the admin sees; later sign-ins only bump the counter and last-seen stamp.
 */
export async function recordArrival(
  userId: number,
  now: Date,
  config: ShopConfig
): Promise<ArrivalResult> {
  const db = await getDb();
  const { dateKey, weekday, minutes } = shopTime(now, config.timezone);
  const today = scheduleForDay(config.workHours, weekday);
  const startMinutes = parseHhMm(today.start);
  const minutesLate = today.open ? Math.max(0, minutes - startMinutes) : 0;
  const late = minutesLate > config.scoring.lateGraceMinutes;
  const scheduledStart = today.open ? formatHhMm(startMinutes) : "";

  const existing = await db
    .select({ id: attendance.id })
    .from(attendance)
    .where(and(eq(attendance.userId, userId), eq(attendance.workDate, dateKey)));

  if (existing.length) {
    await db
      .update(attendance)
      .set({ lastSeenAt: now, logins: sql`${attendance.logins} + 1` })
      .where(eq(attendance.id, existing[0].id));
    return { first: false, dateKey, arrivalMinutes: minutes, minutesLate, late, scheduledStart };
  }

  try {
    await db.insert(attendance).values({
      userId,
      workDate: dateKey,
      firstLoginAt: now,
      lastSeenAt: now,
      scheduledStart,
      arrivalMinutes: minutes,
      minutesLate,
      late,
      logins: 1,
    });
    return { first: true, dateKey, arrivalMinutes: minutes, minutesLate, late, scheduledStart };
  } catch {
    // Two tabs signing in at once — the unique index won. Treat it as a repeat visit.
    await db
      .update(attendance)
      .set({ lastSeenAt: now, logins: sql`${attendance.logins} + 1` })
      .where(and(eq(attendance.userId, userId), eq(attendance.workDate, dateKey)));
    return { first: false, dateKey, arrivalMinutes: minutes, minutesLate, late, scheduledStart };
  }
}

/** "8:14 AM" for an arrival stored as minutes since shop-local midnight. */
export function arrivalLabel(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "12 min late" / "On time" / "23 min early". */
export function latenessLabel(row: { minutesLate: number; late: boolean; arrivalMinutes: number; scheduledStart: string }): string {
  if (row.late) return `${row.minutesLate} min late`;
  const start = parseHhMm(row.scheduledStart);
  if (row.scheduledStart && row.arrivalMinutes < start) return `${start - row.arrivalMinutes} min early`;
  return "On time";
}
