import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, BadgeCheck, AlertTriangle, CalendarClock, Clock } from "lucide-react";
import { getDb, users } from "@/db";
import { Card } from "@/components/ui";
import { GradeChip, ScoreRing, StatTile } from "@/components/performance-ui";
import { PerformancePanel } from "./performance-panel";
import { getShopConfig } from "@/lib/settings";
import { currentPeriod, getAttendance, getEvents, getTeamStats } from "@/lib/performance";
import { arrivalLabel, latenessLabel } from "@/lib/attendance";
import { formatDateKey, monthRange, previousMonthRange } from "@/lib/work-hours";
import { formatDateTime, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TechnicianDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month } = await searchParams;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) notFound();

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) notFound();

  const config = await getShopConfig();
  const period = /^\d{4}-\d{2}$/.test(month || "") ? monthRange(`${month}-01`) : currentPeriod(new Date(), config);
  const [stats] = await getTeamStats(config, period, { userId });
  const prev = previousMonthRange(period.from);
  const [prevStats] = await getTeamStats(config, prev, { userId });
  const events = await getEvents(userId, 100);
  const days = await getAttendance(userId, period);
  if (!stats) notFound();

  const delta = prevStats ? stats.score - prevStats.score : 0;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/team"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-800 mb-1"
        >
          <ArrowLeft className="w-4 h-4" /> Team
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
        <p className="text-sm text-ink-500 mt-0.5">
          {user.title || "Technician"} · {user.username} · {period.label}
          {user.lastLoginAt ? ` · last sign-in ${formatDateTime(user.lastLoginAt)}` : ""}
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <Card className="p-5 lg:col-span-2 flex items-center gap-5">
          <ScoreRing score={stats.score} />
          <div className="min-w-0">
            <GradeChip score={stats.score} />
            <p className="text-[13px] text-ink-600 mt-2">
              {config.scoring.baseScore} base
              <span className={stats.attendancePoints < 0 ? "text-rose-600" : ""}>
                {" "}
                {stats.attendancePoints < 0 ? stats.attendancePoints : `+${stats.attendancePoints}`} attendance
              </span>
              <span className={stats.events.points < 0 ? "text-rose-600" : "text-emerald-600"}>
                {" "}
                {stats.events.points < 0 ? stats.events.points : `+${stats.events.points}`} record
              </span>
            </p>
            {prevStats && (
              <p className="text-[13px] text-ink-500 mt-1.5">
                {prev.label}: {prevStats.score}{" "}
                <span className={delta > 0 ? "text-emerald-600 font-semibold" : delta < 0 ? "text-rose-600 font-semibold" : ""}>
                  ({delta > 0 ? "+" : ""}
                  {delta})
                </span>
              </p>
            )}
          </div>
        </Card>

        <Card
          className={
            "p-5 lg:col-span-3 " + (stats.bonus.eligible ? "border-emerald-300 bg-emerald-50/40" : "")
          }
        >
          <div className="flex items-start gap-3">
            <span
              className={
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 " +
                (stats.bonus.eligible ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")
              }
            >
              {stats.bonus.eligible ? <BadgeCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </span>
            <div className="min-w-0">
              <h2 className="font-bold">
                {stats.bonus.eligible
                  ? `Qualifies for the ${formatMoney(stats.bonus.amount)} bonus`
                  : "Does not qualify for the monthly bonus"}
              </h2>
              <p className="text-[13px] text-ink-600 mt-1">
                Gate: score ≥ {config.scoring.bonusScore}, punctuality ≥ {config.scoring.bonusPunctuality}%
                {config.scoring.bonusBlockOnCritical ? ", no critical mistakes" : ""}.
              </p>
              {stats.bonus.blockers.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {stats.bonus.blockers.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[13px] text-ink-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Punctuality"
          value={`${stats.attendance.punctuality}%`}
          hint={`${stats.attendance.onTime}/${stats.attendance.present} on time`}
          tone={stats.attendance.punctuality >= config.scoring.bonusPunctuality ? "good" : "warn"}
        />
        <StatTile
          label="Average arrival"
          value={arrivalLabel(stats.attendance.avgArrivalMinutes)}
          hint={`${stats.attendance.totalMinutesLate} min late in total`}
        />
        <StatTile
          label="Late / missed"
          value={`${stats.attendance.late} / ${stats.attendance.missed}`}
          hint={`${stats.attendance.scheduled} shifts scheduled`}
          tone={stats.attendance.late + stats.attendance.missed === 0 ? "good" : "warn"}
        />
        <StatTile
          label="Jobs"
          value={`${stats.jobs.created} / ${stats.jobs.completed}`}
          hint="Check-ins taken / jobs completed"
        />
      </div>

      <PerformancePanel
        userId={userId}
        userName={user.name}
        events={events.map((e) => ({ ...e, createdAt: String(e.createdAt) }))}
        defaults={{
          minor: config.scoring.minorMistake,
          major: config.scoring.majorMistake,
          critical: config.scoring.criticalMistake,
          praise: config.scoring.praise,
        }}
      />

      <Card className="p-5">
        <h2 className="font-bold mb-1 flex items-center gap-2">
          <CalendarClock className="w-4.5 h-4.5 text-ink-400" /> Attendance — {period.label}
        </h2>
        <p className="text-[13px] text-ink-500 mb-4">First sign-in of each day, in shop time.</p>
        <div className="divide-y divide-ink-100 -mx-5 max-h-96 overflow-y-auto">
          {days.map((d) => (
            <div key={d.id} className="px-5 py-2.5 flex items-center gap-3">
              <Clock className="w-4 h-4 text-ink-300 shrink-0" />
              <span className="text-sm font-semibold text-ink-800 w-28 shrink-0">
                {formatDateKey(d.workDate, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <span className="text-sm text-ink-600 tabular-nums">{arrivalLabel(d.arrivalMinutes)}</span>
              <span className="text-[12px] text-ink-400">
                {d.scheduledStart ? `scheduled ${d.scheduledStart}` : "no shift"}
              </span>
              <span
                className={"ml-auto text-[12px] font-semibold " + (d.late ? "text-amber-600" : "text-emerald-600")}
              >
                {latenessLabel(d)}
              </span>
            </div>
          ))}
          {days.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-400">No sign-ins recorded this month.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
