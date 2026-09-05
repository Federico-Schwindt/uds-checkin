/**
 * Opening hours live in shop-local time, but the server may run anywhere (Vercel
 * is UTC). Everything here converts through `Intl` with an explicit timezone so
 * "8:00 AM" always means 8:00 AM at the shop.
 */

export type DaySchedule = {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  open: boolean;
  /** "HH:MM", 24h */
  start: string;
  end: string;
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Universal Driveshafts posted hours. */
export const DEFAULT_WORK_HOURS: DaySchedule[] = [
  { day: 0, open: false, start: "09:00", end: "14:00" },
  { day: 1, open: true, start: "08:00", end: "17:00" },
  { day: 2, open: true, start: "08:00", end: "17:00" },
  { day: 3, open: true, start: "08:00", end: "17:00" },
  { day: 4, open: true, start: "08:00", end: "17:00" },
  { day: 5, open: true, start: "08:00", end: "17:00" },
  { day: 6, open: true, start: "09:00", end: "14:00" },
];

export const DEFAULT_TIMEZONE = "America/New_York";

export type ShopTime = {
  /** "YYYY-MM-DD" in shop-local time. */
  dateKey: string;
  /** 0 = Sunday … 6 = Saturday, shop-local. */
  weekday: number;
  /** Minutes since shop-local midnight. */
  minutes: number;
};

/** Break a UTC instant into shop-local calendar parts. */
export function shopTime(date: Date, timezone: string = DEFAULT_TIMEZONE): ShopTime {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
  } catch {
    // Unknown timezone in settings — fall back rather than crash the login.
    return shopTime(date, DEFAULT_TIMEZONE);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
  const dateKey = `${get("year")}-${get("month")}-${get("day")}`;
  // Some runtimes render midnight as "24" under hour12: false.
  const hour = parseInt(get("hour"), 10) % 24;
  const minutes = hour * 60 + parseInt(get("minute"), 10);
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return { dateKey, weekday, minutes };
}

export function parseHhMm(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((value || "").trim());
  if (!m) return 0;
  return Math.min(24 * 60, Math.max(0, parseInt(m[1], 10) * 60 + parseInt(m[2], 10)));
}

export function formatHhMm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "8:00 AM" from minutes-since-midnight. */
export function formatClock(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(minutes)) return "—";
  const m = Math.max(0, Math.round(minutes));
  const h24 = Math.floor(m / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** Normalizes whatever is stored in settings into a complete 7-day schedule. */
export function normalizeWorkHours(stored: unknown): DaySchedule[] {
  const list = Array.isArray(stored) ? (stored as Partial<DaySchedule>[]) : [];
  return DEFAULT_WORK_HOURS.map((fallback) => {
    const found = list.find((d) => Number(d?.day) === fallback.day);
    if (!found) return { ...fallback };
    return {
      day: fallback.day,
      open: typeof found.open === "boolean" ? found.open : fallback.open,
      start: typeof found.start === "string" && found.start ? found.start : fallback.start,
      end: typeof found.end === "string" && found.end ? found.end : fallback.end,
    };
  });
}

export function scheduleForDay(hours: DaySchedule[], weekday: number): DaySchedule {
  return hours.find((d) => d.day === weekday) || DEFAULT_WORK_HOURS[weekday];
}

export type WorkHoursCheck = {
  allowed: boolean;
  /** Sentence explaining a refusal, empty when allowed. */
  reason: string;
  today: DaySchedule;
  /** Minutes past the scheduled start; negative before the shift opens. */
  minutesFromStart: number;
};

/**
 * Can a technician sign in right now? `earlyMinutes` lets them badge in a little
 * before opening; `lateMinutes` keeps the door open past closing for overtime.
 */
export function checkWorkHours(
  now: Date,
  hours: DaySchedule[],
  opts: { timezone?: string; earlyMinutes?: number; lateMinutes?: number } = {}
): WorkHoursCheck {
  const { dateKey, weekday, minutes } = shopTime(now, opts.timezone);
  const today = scheduleForDay(hours, weekday);
  const early = opts.earlyMinutes ?? 30;
  const late = opts.lateMinutes ?? 60;
  const start = parseHhMm(today.start);
  const end = parseHhMm(today.end);
  const minutesFromStart = minutes - start;

  if (!today.open) {
    return {
      allowed: false,
      reason: `The shop is closed on ${DAY_NAMES[weekday]}. Sign-in is only available during working hours.`,
      today,
      minutesFromStart,
    };
  }
  if (minutes < start - early) {
    return {
      allowed: false,
      reason: `Too early — ${DAY_NAMES[weekday]} shift starts at ${formatClock(start)}. You can sign in from ${formatClock(start - early)}.`,
      today,
      minutesFromStart,
    };
  }
  if (minutes > end + late) {
    return {
      allowed: false,
      reason: `The shift ended at ${formatClock(end)} on ${DAY_NAMES[weekday]} (${dateKey}). Sign-in is closed for today.`,
      today,
      minutesFromStart,
    };
  }
  return { allowed: true, reason: "", today, minutesFromStart };
}

/** True when the shop is open at this instant (no early/late grace). */
export function isShopOpen(now: Date, hours: DaySchedule[], timezone?: string): boolean {
  const { weekday, minutes } = shopTime(now, timezone);
  const today = scheduleForDay(hours, weekday);
  return today.open && minutes >= parseHhMm(today.start) && minutes <= parseHhMm(today.end);
}

/** UTC instant for the end of today's shift plus a grace period — used as the technician session expiry. */
export function shiftEndTimestamp(now: Date, hours: DaySchedule[], timezone?: string, graceMinutes = 60): number {
  const { weekday, minutes } = shopTime(now, timezone);
  const today = scheduleForDay(hours, weekday);
  const end = parseHhMm(today.end) + graceMinutes;
  const remaining = end - minutes;
  // Never hand out a session shorter than 30 minutes.
  return now.getTime() + Math.max(30, remaining) * 60_000;
}

/** "Mon–Fri 8:00 AM–5:00 PM · Sat 9:00 AM–2:00 PM · Sun closed" */
export function describeWorkHours(hours: DaySchedule[]): string[] {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const out: string[] = [];
  let run: number[] = [];
  const label = (d: DaySchedule) => (d.open ? `${formatClock(parseHhMm(d.start))}–${formatClock(parseHhMm(d.end))}` : "Closed");
  const flush = () => {
    if (!run.length) return;
    const first = scheduleForDay(hours, run[0]);
    const days = run.length === 1 ? DAY_SHORT[run[0]] : `${DAY_SHORT[run[0]]}–${DAY_SHORT[run[run.length - 1]]}`;
    out.push(`${days} ${label(first)}`);
    run = [];
  };
  for (const day of order) {
    const d = scheduleForDay(hours, day);
    const prev = run.length ? scheduleForDay(hours, run[run.length - 1]) : null;
    if (prev && prev.open === d.open && prev.start === d.start && prev.end === d.end) run.push(day);
    else {
      flush();
      run = [day];
    }
  }
  flush();
  return out;
}

/* ---------- calendar-day helpers (all on "YYYY-MM-DD" shop-local keys) ---------- */

export function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of day keys from `fromKey` to `toKey`. */
export function eachDateKey(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let cur = fromKey;
  // Guard against a bad range producing an unbounded loop.
  for (let i = 0; cur <= toKey && i < 400; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** First and last day key of the month containing `dateKey`. */
export function monthRange(dateKey: string): { from: string; to: string; label: string } {
  const [y, m] = dateKey.split("-").map((n) => parseInt(n, 10));
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label = new Date(`${from}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { from, to, label };
}

/** Previous month's range relative to `dateKey`. */
export function previousMonthRange(dateKey: string): { from: string; to: string; label: string } {
  const { from } = monthRange(dateKey);
  return monthRange(addDays(from, -1));
}

/** Day keys in [fromKey, toKey] the shop is scheduled to be open. */
export function openDaysBetween(hours: DaySchedule[], fromKey: string, toKey: string): string[] {
  return eachDateKey(fromKey, toKey).filter((key) => scheduleForDay(hours, weekdayOf(key)).open);
}

/** "Sep 5" — formats a day key without dragging the viewer's timezone into it. */
export function formatDateKey(dateKey: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  if (isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC", ...opts });
}
