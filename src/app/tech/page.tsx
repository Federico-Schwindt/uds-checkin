import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  Clock,
  LogOut,
  TrendingUp,
} from "lucide-react";
import { attendance, getDb } from "@/db";
import { Card } from "@/components/ui";
import { Logo } from "@/components/logo";
import { EventChip, GradeChip, PointsChip, ScoreRing, StatTile } from "@/components/performance-ui";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession } from "@/lib/session";
import { getShopConfig } from "@/lib/settings";
import { currentPeriod, getAttendance, getEvents, getTeamStats } from "@/lib/performance";
import { arrivalLabel, latenessLabel } from "@/lib/attendance";
import { describeWorkHours, formatDateKey, previousMonthRange, shopTime } from "@/lib/work-hours";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Performance | UDS" };

export default async function TechPanel() {
  const session = await getSession();
  if (!session) redirect("/lock?next=/tech");

  const config = await getShopConfig();
  const now = new Date();
  const period = currentPeriod(now, config);
  const [stats] = await getTeamStats(config, period, { userId: session.uid });
  if (!stats) redirect("/");

  const prev = previousMonthRange(period.from);
  const [prevStats] = await getTeamStats(config, prev, { userId: session.uid });
  const delta = prevStats ? stats.score - prevStats.score : 0;

  const events = await getEvents(session.uid, 25);
  const days = await getAttendance(session.uid, period);

  const db = await getDb();
  const todayKey = shopTime(now, config.timezone).dateKey;
  const [today] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.userId, session.uid), eq(attendance.workDate, todayKey)));

  const schedule = describeWorkHours(config.workHours);
  const { scoring } = config;

  return (
    <div className="min-h-dvh bg-ink-100">
      <header className="bg-white border-b border-ink-200 sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo className="h-7 sm:h-8" />
            <span className="hidden sm:block text-sm text-ink-400 border-l border-ink-200 pl-3">My Performance</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/"
              className="inline-flex items-center gap-2 h-10 px-3 sm:px-4 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> <span className="max-sm:hidden">Station</span>
            </Link>
            <SignOutButton className="inline-flex items-center gap-2 h-10 px-3 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 text-sm font-semibold transition-colors">
              <LogOut className="w-4 h-4" /> <span className="max-sm:hidden">Sign out</span>
            </SignOutButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 sm:px-6 py-5 sm:py-7 space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hi, {session.name.split(" ")[0]}</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            Your scorecard for {period.label} · {stats.title || "Technician"}
          </p>
        </div>

        {/* Today */}
        <Card className="p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                Today · {formatDateKey(todayKey, { weekday: "long", month: "short", day: "numeric" })}
              </p>
              {today ? (
                <p className="font-bold text-ink-900">
                  Clocked in at {arrivalLabel(today.arrivalMinutes)}
                  <span
                    className={
                      "ml-2 text-[13px] font-semibold " + (today.late ? "text-amber-600" : "text-emerald-600")
                    }
                  >
                    {latenessLabel(today)}
                  </span>
                </p>
              ) : (
                <p className="font-bold text-ink-500">No sign-in recorded yet today</p>
              )}
            </div>
            <div className="ml-auto text-right max-sm:w-full max-sm:text-left max-sm:mt-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Working hours</p>
              <p className="text-[13px] text-ink-600">{schedule.join(" · ")}</p>
            </div>
          </div>
        </Card>

        {/* Score + bonus */}
        <div className="grid lg:grid-cols-5 gap-5">
          <Card className="p-5 lg:col-span-2 flex items-center gap-5">
            <ScoreRing score={stats.score} />
            <div className="min-w-0">
              <GradeChip score={stats.score} />
              <p className="text-sm text-ink-600 mt-2 leading-relaxed">
                Everyone starts the month at {scoring.baseScore}. Late arrivals, missed shifts and job mistakes take
                points off; recognition adds them back.
              </p>
              {prevStats && (
                <p className="text-[13px] font-semibold mt-2 flex items-center gap-1.5">
                  <TrendingUp
                    className={
                      "w-4 h-4 " + (delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600 rotate-180" : "text-ink-400")
                    }
                  />
                  <span className={delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-ink-500"}>
                    {delta > 0 ? "+" : ""}
                    {delta} vs {prev.label.split(" ")[0]}
                  </span>
                </p>
              )}
            </div>
          </Card>

          <Card
            className={
              "p-5 lg:col-span-3 " +
              (stats.bonus.eligible ? "border-emerald-300 bg-emerald-50/40" : "border-ink-200")
            }
          >
            <div className="flex items-start gap-3">
              <span
                className={
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 " +
                  (stats.bonus.eligible ? "bg-emerald-100 text-emerald-700" : "bg-ink-100 text-ink-500")
                }
              >
                {stats.bonus.eligible ? <BadgeCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">
                  {stats.bonus.eligible
                    ? `On track for the ${formatMoney(stats.bonus.amount)} monthly bonus`
                    : "Monthly bonus — not qualified yet"}
                </h2>
                <p className="text-[13px] text-ink-600 mt-1">
                  Requires a score of {scoring.bonusScore}+, {scoring.bonusPunctuality}%+ punctuality
                  {scoring.bonusBlockOnCritical ? " and no critical mistakes" : ""} for the month.
                </p>
                {stats.bonus.blockers.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {stats.bonus.blockers.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-[13px] text-ink-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
                {stats.bonus.eligible && (
                  <p className="mt-3 text-[13px] font-semibold text-emerald-700">
                    Keep it up — the bonus is confirmed at the end of {period.label}.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Punctuality"
            value={`${stats.attendance.punctuality}%`}
            hint={`${stats.attendance.onTime} of ${stats.attendance.present} days on time`}
            tone={stats.attendance.punctuality >= scoring.bonusPunctuality ? "good" : "warn"}
          />
          <StatTile
            label="Late arrivals"
            value={stats.attendance.late}
            hint={stats.attendance.totalMinutesLate ? `${stats.attendance.totalMinutesLate} min total` : "None"}
            tone={stats.attendance.late === 0 ? "good" : "warn"}
          />
          <StatTile
            label="Average arrival"
            value={arrivalLabel(stats.attendance.avgArrivalMinutes)}
            hint={`${stats.attendance.present} days worked`}
          />
          <StatTile
            label="Missed shifts"
            value={stats.attendance.missed}
            hint={`${stats.attendance.scheduled} scheduled`}
            tone={stats.attendance.missed === 0 ? "good" : "bad"}
          />
          <StatTile label="Check-ins taken" value={stats.jobs.created} hint="Work orders you created" />
          <StatTile label="Jobs assigned" value={stats.jobs.assigned} hint="This month" />
          <StatTile label="Jobs completed" value={stats.jobs.completed} tone="good" />
          <StatTile
            label="Mistakes flagged"
            value={stats.events.minor + stats.events.major + stats.events.critical}
            hint={`${stats.events.critical} critical · ${stats.events.major} major · ${stats.events.minor} minor`}
            tone={stats.events.critical + stats.events.major > 0 ? "bad" : "good"}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Ledger */}
          <Card className="p-5">
            <h2 className="font-bold mb-1 flex items-center gap-2">
              <ClipboardList className="w-4.5 h-4.5 text-ink-400" /> Performance record
            </h2>
            <p className="text-[13px] text-ink-500 mb-4">Everything your manager logged, newest first.</p>
            <div className="divide-y divide-ink-100 -mx-5">
              {events.map((e) => (
                <div key={e.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <EventChip type={e.type} severity={e.severity} />
                      <span className="text-sm font-semibold text-ink-900">{e.category || "General"}</span>
                    </div>
                    {e.note && <p className="text-[13px] text-ink-600 mt-1 break-words">{e.note}</p>}
                    <p className="text-[11px] text-ink-400 mt-1">
                      {new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {e.entryId ? ` · Entry #${e.entryId}` : ""}
                      {e.createdBy ? ` · by ${e.createdBy}` : ""}
                    </p>
                  </div>
                  <PointsChip points={e.points} />
                </div>
              ))}
              {events.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-ink-400">
                  Nothing logged. A clean record is the best record.
                </p>
              )}
            </div>
          </Card>

          {/* Attendance */}
          <Card className="p-5">
            <h2 className="font-bold mb-1 flex items-center gap-2">
              <CalendarClock className="w-4.5 h-4.5 text-ink-400" /> Attendance — {period.label}
            </h2>
            <p className="text-[13px] text-ink-500 mb-4">Your first sign-in of each day.</p>
            <div className="divide-y divide-ink-100 -mx-5 max-h-[420px] overflow-y-auto">
              {days.map((d) => (
                <div key={d.id} className="px-5 py-2.5 flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink-800 w-20 shrink-0">
                    {formatDateKey(d.workDate, { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="text-sm text-ink-600 tabular-nums">{arrivalLabel(d.arrivalMinutes)}</span>
                  <span
                    className={
                      "ml-auto text-[12px] font-semibold " + (d.late ? "text-amber-600" : "text-emerald-600")
                    }
                  >
                    {latenessLabel(d)}
                  </span>
                </div>
              ))}
              {days.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-ink-400">No sign-ins recorded this month yet.</p>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
