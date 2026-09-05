import { and, asc, count, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { getDb, attendance, entries, performanceEvents, users } from "@/db";
import type { ShopConfig } from "@/lib/settings";
import { gradeFor, type ScoringConfig } from "@/lib/performance-config";
import { monthRange, openDaysBetween, shopTime } from "@/lib/work-hours";

export type Period = { from: string; to: string; label: string };

export type AttendanceStats = {
  /** Scheduled open days in the period, from the technician's start date to today. */
  scheduled: number;
  present: number;
  onTime: number;
  late: number;
  missed: number;
  /** Average arrival as minutes since shop-local midnight, null when never present. */
  avgArrivalMinutes: number | null;
  totalMinutesLate: number;
  /** on-time / present, as a percentage. 100 when there is nothing to judge yet. */
  punctuality: number;
};

export type EventTotals = {
  minor: number;
  major: number;
  critical: number;
  praise: number;
  /** Net points from the manual ledger. */
  points: number;
};

export type TechStats = {
  userId: number;
  name: string;
  username: string;
  title: string;
  active: boolean;
  period: Period;
  attendance: AttendanceStats;
  jobs: { created: number; assigned: number; completed: number };
  events: EventTotals;
  /** Points lost to lateness / missed shifts. */
  attendancePoints: number;
  score: number;
  grade: ReturnType<typeof gradeFor>;
  bonus: { eligible: boolean; amount: number; blockers: string[] };
};

export type PerformanceEventRow = {
  id: number;
  userId: number;
  entryId: number | null;
  type: string;
  severity: string;
  category: string;
  note: string;
  points: number;
  createdBy: string;
  createdAt: Date;
};

/** The month containing `now` in shop-local time. */
export function currentPeriod(now: Date, config: ShopConfig): Period {
  return monthRange(shopTime(now, config.timezone).dateKey);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Turns raw rows into a score. Kept pure so the numbers are easy to reason about. */
export function computeScore(
  scoring: ScoringConfig,
  att: AttendanceStats,
  events: EventTotals
): { score: number; attendancePoints: number } {
  const attendancePoints =
    att.late * -Math.abs(scoring.latePenalty) + att.missed * -Math.abs(scoring.absentPenalty);
  const score = clamp(Math.round(scoring.baseScore + attendancePoints + events.points), 0, 100);
  return { score, attendancePoints };
}

function bonusCheck(
  scoring: ScoringConfig,
  score: number,
  att: AttendanceStats,
  events: EventTotals
): { eligible: boolean; amount: number; blockers: string[] } {
  const blockers: string[] = [];
  if (score < scoring.bonusScore) blockers.push(`Score ${score} is below the ${scoring.bonusScore} threshold`);
  if (att.punctuality < scoring.bonusPunctuality) {
    blockers.push(`Punctuality ${att.punctuality}% is below ${scoring.bonusPunctuality}%`);
  }
  if (scoring.bonusBlockOnCritical && events.critical > 0) {
    blockers.push(`${events.critical} critical mistake${events.critical > 1 ? "s" : ""} this period`);
  }
  return { eligible: blockers.length === 0, amount: scoring.bonusAmount, blockers };
}

type AttendanceRow = {
  workDate: string;
  arrivalMinutes: number;
  minutesLate: number;
  late: boolean;
  scheduledStart: string;
};

/**
 * Scheduled days only count from the day the profile was created and never into
 * the future, so a new hire (or a fresh deployment) doesn't start at zero.
 */
function attendanceStats(
  rows: AttendanceRow[],
  config: ShopConfig,
  period: Period,
  todayKey: string,
  startedOn: string
): AttendanceStats {
  const from = period.from > startedOn ? period.from : startedOn;
  // Today is still in progress — judging it as "missed" before closing time is wrong.
  const to = period.to < todayKey ? period.to : todayKey;
  const scheduledDays = to < from ? [] : openDaysBetween(config.workHours, from, to);
  const scheduledSet = new Set(scheduledDays);

  const present = rows.filter((r) => r.workDate >= from && r.workDate <= to);
  const late = present.filter((r) => r.late).length;
  const onTime = present.length - late;
  const presentDays = new Set(present.map((r) => r.workDate));
  // Only days before today can count as missed.
  const missed = scheduledDays.filter((d) => d < todayKey && !presentDays.has(d)).length;
  const avgArrivalMinutes = present.length
    ? Math.round(present.reduce((sum, r) => sum + r.arrivalMinutes, 0) / present.length)
    : null;
  // Only arrivals past the grace window count — a 2-minute overrun is on time.
  const totalMinutesLate = present.filter((r) => r.late).reduce((sum, r) => sum + r.minutesLate, 0);

  return {
    scheduled: scheduledSet.size,
    present: present.length,
    onTime,
    late,
    missed,
    avgArrivalMinutes,
    totalMinutesLate,
    punctuality: present.length ? Math.round((onTime / present.length) * 100) : 100,
  };
}

function eventTotals(rows: Array<{ type: string; severity: string; points: number }>): EventTotals {
  const totals: EventTotals = { minor: 0, major: 0, critical: 0, praise: 0, points: 0 };
  for (const r of rows) {
    totals.points += r.points;
    if (r.type === "praise") totals.praise++;
    else if (r.type === "mistake") {
      if (r.severity === "critical") totals.critical++;
      else if (r.severity === "major") totals.major++;
      else totals.minor++;
    }
  }
  return totals;
}

/** Full stats for every technician (optionally a single one) over one period. */
export async function getTeamStats(
  config: ShopConfig,
  period: Period,
  opts: { userId?: number; includeInactive?: boolean } = {}
): Promise<TechStats[]> {
  const db = await getDb();
  const todayKey = shopTime(new Date(), config.timezone).dateKey;

  const staff = await db
    .select()
    .from(users)
    .where(opts.userId ? eq(users.id, opts.userId) : eq(users.role, "tech"))
    .orderBy(asc(users.name));
  const list = opts.includeInactive || opts.userId ? staff : staff.filter((u) => u.active);
  if (!list.length) return [];
  const ids = list.map((u) => u.id);

  const attRows = await db
    .select({
      userId: attendance.userId,
      workDate: attendance.workDate,
      arrivalMinutes: attendance.arrivalMinutes,
      minutesLate: attendance.minutesLate,
      late: attendance.late,
      scheduledStart: attendance.scheduledStart,
    })
    .from(attendance)
    .where(
      and(inArray(attendance.userId, ids), gte(attendance.workDate, period.from), lte(attendance.workDate, period.to))
    );

  const periodStart = new Date(`${period.from}T00:00:00Z`);
  const periodEnd = new Date(`${period.to}T23:59:59Z`);

  const eventRows = await db
    .select({
      userId: performanceEvents.userId,
      type: performanceEvents.type,
      severity: performanceEvents.severity,
      points: performanceEvents.points,
    })
    .from(performanceEvents)
    .where(
      and(
        inArray(performanceEvents.userId, ids),
        gte(performanceEvents.createdAt, periodStart),
        lte(performanceEvents.createdAt, periodEnd)
      )
    );

  const createdRows = await db
    .select({ userId: entries.createdByUserId, n: count() })
    .from(entries)
    .where(
      and(
        isNull(entries.deletedAt),
        inArray(entries.createdByUserId, ids),
        gte(entries.createdAt, periodStart),
        lte(entries.createdAt, periodEnd)
      )
    )
    .groupBy(entries.createdByUserId);
  const createdMap = new Map(createdRows.map((r) => [r.userId, r.n]));

  // Jobs are assigned by name (the dropdown predates user accounts).
  const assignedRows = await db
    .select({ name: entries.assignedEmployee, status: entries.jobStatus, n: count() })
    .from(entries)
    .where(and(isNull(entries.deletedAt), gte(entries.createdAt, periodStart), lte(entries.createdAt, periodEnd)))
    .groupBy(entries.assignedEmployee, entries.jobStatus);

  return list.map((u) => {
    const att = attendanceStats(
      attRows.filter((r) => r.userId === u.id),
      config,
      period,
      todayKey,
      (u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt)).toISOString().slice(0, 10)
    );
    const events = eventTotals(eventRows.filter((r) => r.userId === u.id));
    const { score, attendancePoints } = computeScore(config.scoring, att, events);
    const mine = assignedRows.filter((r) => r.name && r.name === u.name);
    return {
      userId: u.id,
      name: u.name,
      username: u.username,
      title: u.title,
      active: u.active,
      period,
      attendance: att,
      jobs: {
        created: createdMap.get(u.id) || 0,
        assigned: mine.reduce((sum, r) => sum + r.n, 0),
        completed: mine.filter((r) => r.status === "Completed").reduce((sum, r) => sum + r.n, 0),
      },
      events,
      attendancePoints,
      score,
      grade: gradeFor(score),
      bonus: bonusCheck(config.scoring, score, att, events),
    };
  });
}

/** The points ledger for one technician, newest first. */
export async function getEvents(userId: number, limit = 50): Promise<PerformanceEventRow[]> {
  const db = await getDb();
  return (await db
    .select()
    .from(performanceEvents)
    .where(eq(performanceEvents.userId, userId))
    .orderBy(desc(performanceEvents.createdAt))
    .limit(limit)) as PerformanceEventRow[];
}

/** Attendance rows for one technician inside a period, oldest first. */
export async function getAttendance(userId: number, period: Period) {
  const db = await getDb();
  return db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.userId, userId),
        gte(attendance.workDate, period.from),
        lte(attendance.workDate, period.to)
      )
    )
    .orderBy(desc(attendance.workDate));
}

/** Everyone's attendance for a single day, including the technicians who never showed. */
export async function getDayBoard(dateKey: string) {
  const db = await getDb();
  const staff = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "tech"), eq(users.active, true)))
    .orderBy(asc(users.name));
  const rows = await db.select().from(attendance).where(eq(attendance.workDate, dateKey));
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  return staff.map((u) => ({ user: u, record: byUser.get(u.id) || null }));
}

/** Performance events flagged against a specific job. */
export async function getEntryEvents(entryId: number) {
  const db = await getDb();
  return db
    .select({
      id: performanceEvents.id,
      userId: performanceEvents.userId,
      type: performanceEvents.type,
      severity: performanceEvents.severity,
      category: performanceEvents.category,
      note: performanceEvents.note,
      points: performanceEvents.points,
      createdBy: performanceEvents.createdBy,
      createdAt: performanceEvents.createdAt,
      userName: users.name,
    })
    .from(performanceEvents)
    .leftJoin(users, eq(performanceEvents.userId, users.id))
    .where(eq(performanceEvents.entryId, entryId))
    .orderBy(desc(performanceEvents.createdAt));
}

/** Team-wide numbers for the admin dashboard. */
export async function getTeamSummary(config: ShopConfig, period: Period) {
  const stats = await getTeamStats(config, period);
  const db = await getDb();
  const todayKey = shopTime(new Date(), config.timezone).dateKey;
  const [flagged] = await db
    .select({ n: count() })
    .from(performanceEvents)
    .where(
      and(
        eq(performanceEvents.type, "mistake"),
        gte(performanceEvents.createdAt, new Date(`${period.from}T00:00:00Z`))
      )
    );
  const avgScore = stats.length ? Math.round(stats.reduce((s, t) => s + t.score, 0) / stats.length) : 0;
  return {
    stats,
    todayKey,
    avgScore,
    mistakes: flagged?.n || 0,
    bonusReady: stats.filter((s) => s.bonus.eligible).length,
  };
}

/** Shop-local "today" as a YYYY-MM-DD key. */
export const todayKeyFor = (config: ShopConfig) => shopTime(new Date(), config.timezone).dateKey;
