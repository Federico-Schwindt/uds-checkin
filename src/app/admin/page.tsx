import Link from "next/link";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { AlertTriangle, ArrowUpRight, BadgeCheck, CheckCircle2, Clock, Users } from "lucide-react";
import { getDb, entries, customers, messageLog } from "@/db";
import { StatusBadge, Card } from "@/components/ui";
import { GradeChip } from "@/components/performance-ui";
import { formatDateTime, formatMoney, formatPhone } from "@/lib/utils";
import { getShopConfig } from "@/lib/settings";
import { currentPeriod, getDayBoard, getTeamStats, todayKeyFor } from "@/lib/performance";
import { arrivalLabel, latenessLabel } from "@/lib/attendance";
import {
  addDays,
  formatClock,
  formatDateKey,
  isShopOpen,
  parseHhMm,
  scheduleForDay,
  shopDayStart,
  weekdayOf,
} from "@/lib/work-hours";

export const dynamic = "force-dynamic";

type Warning = {
  tone: "bad" | "warn" | "info";
  title: string;
  detail: string;
  href: string;
};

export default async function AdminDashboard() {
  const db = await getDb();
  const now = new Date();

  // Every "day" on this page is a shop day in Odessa, not a day on the server's
  // clock — otherwise "today" would roll over at 8pm local time on a UTC host.
  const config = await getShopConfig();
  const todayKey = todayKeyFor(config);
  const todayStart = shopDayStart(todayKey, config.timezone);
  const weekStart = shopDayStart(addDays(todayKey, -6), config.timezone);
  const monthStart = shopDayStart(addDays(todayKey, -29), config.timezone);

  const live = isNull(entries.deletedAt);
  const [today] = await db.select({ n: count() }).from(entries).where(and(live, gte(entries.createdAt, todayStart)));
  const [week] = await db.select({ n: count() }).from(entries).where(and(live, gte(entries.createdAt, weekStart)));
  const [month] = await db.select({ n: count() }).from(entries).where(and(live, gte(entries.createdAt, monthStart)));

  const byStatus = await db
    .select({ status: entries.jobStatus, n: count() })
    .from(entries)
    .where(live)
    .groupBy(entries.jobStatus);
  const statusMap = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));

  const [smsFailed] = await db
    .select({ n: count() })
    .from(messageLog)
    .where(and(eq(messageLog.status, "failed"), gte(messageLog.createdAt, weekStart)));

  // Last 14 days volume for the mini chart. Timestamps are stored in UTC, so the
  // bucket key is converted into shop time before it is grouped.
  const shopDay = sql<string>`to_char(${entries.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE ${config.timezone}, 'YYYY-MM-DD')`;
  const daily = await db
    .select({ day: shopDay, n: count() })
    .from(entries)
    .where(and(live, gte(entries.createdAt, shopDayStart(addDays(todayKey, -13), config.timezone))))
    // Group by the output column: repeating the expression would re-bind the
    // timezone as a second parameter, which Postgres will not match.
    .groupBy(sql`1`);
  const dailyMap = Object.fromEntries(daily.map((d) => [d.day, d.n]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const key = addDays(todayKey, -(13 - i));
    return { key, label: formatDateKey(key, { weekday: "short" }), n: dailyMap[key] || 0 };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.n));

  const recent = await db
    .select({
      id: entries.id,
      jobNumber: entries.jobNumber,
      jobStatus: entries.jobStatus,
      vehicleYear: entries.vehicleYear,
      vehicleMake: entries.vehicleMake,
      vehicleModel: entries.vehicleModel,
      createdAt: entries.createdAt,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
    })
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(live)
    .orderBy(desc(entries.createdAt))
    .limit(8);

  /* ---------- team, attendance and warnings ---------- */
  const period = currentPeriod(now, config);
  const team = await getTeamStats(config, period);
  const board = await getDayBoard(todayKey);
  const todaySchedule = scheduleForDay(config.workHours, weekdayOf(todayKey));
  const shopOpen = isShopOpen(now, config.workHours, config.timezone);

  const warnings: Warning[] = [];
  for (const { user, record } of board) {
    if (record?.late) {
      warnings.push({
        tone: record.minutesLate > 30 ? "bad" : "warn",
        title: `${user.name} arrived late`,
        detail: `Clocked in at ${arrivalLabel(record.arrivalMinutes)} — ${record.minutesLate} min after the ${record.scheduledStart} start.`,
        href: `/admin/team/${user.id}`,
      });
    }
  }
  // Only chase missing sign-ins once the shift has actually started.
  if (todaySchedule.open && shopOpen) {
    const notIn = board.filter((b) => !b.record);
    if (notIn.length) {
      warnings.push({
        tone: "bad",
        title: `${notIn.length} technician${notIn.length > 1 ? "s have" : " has"} not signed in`,
        detail: `${notIn.map((b) => b.user.name).join(", ")} — shift started at ${formatClock(parseHhMm(todaySchedule.start))}.`,
        href: "/admin/attendance",
      });
    }
  }
  for (const t of team) {
    if (t.events.critical > 0) {
      warnings.push({
        tone: "bad",
        title: `${t.name} has ${t.events.critical} critical mistake${t.events.critical > 1 ? "s" : ""}`,
        detail: `Score ${t.score} this month. The monthly bonus is blocked while a critical mistake stands.`,
        href: `/admin/team/${t.userId}`,
      });
    } else if (t.score < 70) {
      warnings.push({
        tone: "warn",
        title: `${t.name} is underperforming`,
        detail: `Score ${t.score} (${t.attendance.late} late, ${t.attendance.missed} missed, ${t.events.major + t.events.minor} mistakes).`,
        href: `/admin/team/${t.userId}`,
      });
    }
    if (t.attendance.missed >= 2) {
      warnings.push({
        tone: "warn",
        title: `${t.name} missed ${t.attendance.missed} shifts`,
        detail: `Out of ${t.attendance.scheduled} scheduled working days this month.`,
        href: `/admin/attendance`,
      });
    }
  }
  if (smsFailed.n > 0) {
    warnings.push({
      tone: "warn",
      title: `${smsFailed.n} customer message${smsFailed.n > 1 ? "s" : ""} failed to send`,
      detail: "Check the Twilio / SMTP credentials and the message log.",
      href: "/admin/messages",
    });
  }

  const presentToday = board.filter((b) => b.record).length;
  const lateToday = board.filter((b) => b.record?.late).length;
  const bonusReady = team.filter((t) => t.bonus.eligible).length;
  const leaderboard = [...team].sort((a, b) => b.score - a.score);

  const statuses = ["New", "Confirmed", "Ongoing", "On hold", "Completed"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Link
          href="/checkin"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          New check-in <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi label="Check-ins today" value={today.n} />
        <Kpi label="Last 7 days" value={week.n} />
        <Kpi label="Last 30 days" value={month.n} />
        <Kpi
          label={`On shift now (${presentToday}/${board.length})`}
          value={presentToday}
          tone={todaySchedule.open && presentToday < board.length ? "bad" : "good"}
        />
        <Kpi label="Late arrivals today" value={lateToday} tone={lateToday > 0 ? "bad" : "good"} />
      </div>

      {/* Warnings */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-500" /> Needs your attention
          </h2>
          <span className="text-[13px] text-ink-500">{period.label}</span>
        </div>
        {warnings.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-medium text-emerald-800">
              Everything looks good — everyone signed in on time and no mistakes are open.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {warnings.slice(0, 8).map((w, i) => (
              <Link
                key={`${w.title}-${i}`}
                href={w.href}
                className={
                  "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors " +
                  (w.tone === "bad"
                    ? "border-rose-200 bg-rose-50 hover:bg-rose-100/70"
                    : "border-amber-200 bg-amber-50 hover:bg-amber-100/70")
                }
              >
                <AlertTriangle
                  className={"w-4.5 h-4.5 shrink-0 mt-0.5 " + (w.tone === "bad" ? "text-rose-600" : "text-amber-600")}
                />
                <span className="min-w-0">
                  <span
                    className={
                      "block text-sm font-bold " + (w.tone === "bad" ? "text-rose-900" : "text-amber-900")
                    }
                  >
                    {w.title}
                  </span>
                  <span className={"block text-[13px] " + (w.tone === "bad" ? "text-rose-800" : "text-amber-800")}>
                    {w.detail}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Team */}
      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <Users className="w-4.5 h-4.5 text-ink-400" /> Technician scores
            </h2>
            <Link href="/admin/team" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              Full team view
            </Link>
          </div>
          <div className="divide-y divide-ink-100 -mx-5">
            {leaderboard.map((t) => (
              <Link
                key={t.userId}
                href={`/admin/team/${t.userId}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50 transition-colors"
              >
                <span
                  className={
                    "text-2xl font-bold w-12 shrink-0 tabular-nums " +
                    (t.score >= 90
                      ? "text-emerald-600"
                      : t.score >= 75
                        ? "text-brand-600"
                        : t.score >= 60
                          ? "text-amber-600"
                          : "text-rose-600")
                  }
                >
                  {t.score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900 truncate">{t.name}</span>
                  <span className="block text-[13px] text-ink-500 truncate">
                    {t.attendance.punctuality}% on time · {t.jobs.created} check-ins ·{" "}
                    {t.events.minor + t.events.major + t.events.critical} mistakes
                  </span>
                </span>
                {t.bonus.eligible && (
                  <BadgeCheck className="w-4.5 h-4.5 text-emerald-600 shrink-0" aria-label="Bonus eligible" />
                )}
                <GradeChip score={t.score} />
              </Link>
            ))}
            {leaderboard.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-ink-400">
                No technician profiles yet.{" "}
                <Link href="/admin/team" className="text-brand-700 font-semibold">
                  Add one
                </Link>
                .
              </p>
            )}
          </div>
          {leaderboard.length > 0 && (
            <p className="text-[13px] text-ink-500 mt-4 pt-3 border-t border-ink-100">
              {bonusReady} of {leaderboard.length} on track for the {formatMoney(config.scoring.bonusAmount)} monthly
              bonus.
            </p>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-ink-400" /> Today&apos;s arrivals
            </h2>
            <Link href="/admin/attendance" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              Board
            </Link>
          </div>
          <p className="text-[13px] text-ink-500 mb-3">
            {todaySchedule.open
              ? `Shift ${formatClock(parseHhMm(todaySchedule.start))}–${formatClock(parseHhMm(todaySchedule.end))}`
              : "Shop closed today"}
          </p>
          <div className="divide-y divide-ink-100 -mx-5">
            {board.map(({ user, record }) => (
              <div key={user.id} className="flex items-center gap-3 px-5 py-2.5">
                <span
                  className={
                    "w-2 h-2 rounded-full shrink-0 " +
                    (!record ? "bg-ink-300" : record.late ? "bg-amber-500" : "bg-emerald-500")
                  }
                />
                <span className="text-sm font-semibold text-ink-800 truncate flex-1">{user.name}</span>
                <span className="text-sm text-ink-600 tabular-nums">
                  {record ? arrivalLabel(record.arrivalMinutes) : "—"}
                </span>
                <span
                  className={
                    "text-[12px] font-semibold w-20 text-right " +
                    (!record ? "text-ink-400" : record.late ? "text-amber-600" : "text-emerald-600")
                  }
                >
                  {record ? latenessLabel(record) : "Not in"}
                </span>
              </div>
            ))}
            {board.length === 0 && <p className="px-5 py-6 text-center text-sm text-ink-400">No technicians.</p>}
          </div>
        </Card>
      </div>

      {/* Status pipeline */}
      <Card className="p-5">
        <h2 className="font-bold mb-4">Jobs by status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {statuses.map((st) => (
            <Link
              key={st}
              href={`/admin/entries?status=${encodeURIComponent(st)}`}
              className="rounded-xl border border-ink-200 px-4 py-3 hover:border-brand-400 hover:shadow-card transition-all"
            >
              <p className="text-2xl font-bold">{statusMap[st] || 0}</p>
              <StatusBadge status={st} className="mt-1.5" />
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Volume chart */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="font-bold mb-4">Check-ins — last 14 days</h2>
          <div className="flex items-end gap-1.5 h-36">
            {days.map((d) => (
              <div key={d.key} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.key}: ${d.n}`}>
                <span className="text-[10px] text-ink-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {d.n}
                </span>
                <div
                  className="w-full rounded-t-md bg-brand-500/80 group-hover:bg-brand-600 transition-colors min-h-[3px]"
                  style={{ height: `${(d.n / maxDay) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-ink-400">
            <span>{formatDateKey(days[0].key)}</span>
            <span>Today</span>
          </div>
        </Card>

        {/* Recent entries */}
        <Card className="p-5 lg:col-span-3 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Recent check-ins</h2>
            <Link href="/admin/entries" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              View all
            </Link>
          </div>
          <div className="divide-y divide-ink-100 -mx-5">
            {recent.map((r) => (
              <Link
                key={r.id}
                href={`/admin/entries/${r.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-900 truncate">
                    {r.firstName} {r.lastName}
                    {r.jobNumber ? <span className="text-ink-400 font-normal"> · Job {r.jobNumber}</span> : null}
                  </p>
                  <p className="text-sm text-ink-500 truncate">
                    {[r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(" ") || "No vehicle info"} ·{" "}
                    {formatPhone(r.phone || "")}
                  </p>
                </div>
                <span className="text-xs text-ink-400 whitespace-nowrap max-sm:hidden">
                  {formatDateTime(r.createdAt)}
                </span>
                <StatusBadge status={r.jobStatus} />
              </Link>
            ))}
            {recent.length === 0 && <p className="px-5 py-8 text-center text-ink-400 text-sm">No check-ins yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <Card className="p-5">
      <p
        className={
          "text-3xl font-bold " +
          (tone === "bad" && value > 0 ? "text-brand-600" : tone === "good" ? "text-emerald-600" : "text-ink-900")
        }
      >
        {value}
      </p>
      <p className="text-[13px] font-medium text-ink-500 mt-1">{label}</p>
    </Card>
  );
}
