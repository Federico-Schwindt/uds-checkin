import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  Clock,
  PartyPopper,
  TrendingUp,
} from "lucide-react";
import { announcementReads, announcements, assignments, attendance, customers, entries, getDb, requests } from "@/db";
import { Card, StatusBadge } from "@/components/ui";
import { EventChip, GradeChip, PointsChip, ScoreRing, StatTile } from "@/components/performance-ui";
import { AppShell } from "@/components/app-shell";
import { MyCalendar, MyRequests, NoticeBoard } from "@/components/tech-panel-sections";
import { NewCheckinButton } from "@/components/new-checkin-button";
import { getSession } from "@/lib/session";
import { getShopConfig } from "@/lib/settings";
import { currentPeriod, getAttendance, getEvents, getTeamStats } from "@/lib/performance";
import { arrivalLabel, latenessLabel } from "@/lib/attendance";
import { addDays, describeWorkHours, formatDateKey, previousMonthRange, shopTime } from "@/lib/work-hours";
import { myCelebration } from "@/lib/celebrations";
import {formatDateTime} from "@/lib/utils";

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
  const todayKey = shopTime(now, config.timezone).dateKey;

  const db = await getDb();
  const [today] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.userId, session.uid), eq(attendance.workDate, todayKey)));

  // Notices this technician has not acknowledged, newest first.
  const seen = await db
    .select({ id: announcementReads.announcementId })
    .from(announcementReads)
    .where(eq(announcementReads.userId, session.uid));
  const seenIds = new Set(seen.map((r) => r.id));
  const liveNotices = await db
    .select()
    .from(announcements)
    .where(or(isNull(announcements.expiresAt), gte(announcements.expiresAt, now)))
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
    .limit(20);
  const notices = liveNotices.filter((n) => !seenIds.has(n.id));

  // The calendar looks a little back and a month ahead.
  const myAssignments = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.userId, session.uid),
        gte(assignments.workDate, addDays(todayKey, -1)),
        lte(assignments.workDate, addDays(todayKey, 45))
      )
    )
    .orderBy(asc(assignments.workDate), asc(assignments.startTime));
  const unseenAssignments = myAssignments.filter((a) => !a.seenAt && a.status !== "cancelled");

  const myRequests = await db
    .select()
    .from(requests)
    .where(eq(requests.userId, session.uid))
    .orderBy(desc(requests.lastMessageAt))
    .limit(25);

  // The check-ins this technician took, newest first.
  const myCheckins = await db
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
    })
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(and(eq(entries.createdByUserId, session.uid), isNull(entries.deletedAt)))
    .orderBy(desc(entries.createdAt))
    .limit(8);

  const celebrations = await myCelebration(session.uid, todayKey, Number(config.celebrationLeadDays) || 7);

  const schedule = describeWorkHours(config.workHours);
  const { scoring } = config;

  return (
    <AppShell session={session} active="/tech" actions={<NewCheckinButton className="h-10 px-4 text-sm" />}>
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Hi, {session.name.split(" ")[0]}</h2>
          <p className="text-sm text-ink-500 mt-0.5">
            {period.label} · {stats.title || "Technician"}
          </p>
        </div>

        {unseenAssignments.length > 0 && (
          <div className="rounded-2xl border border-brand-300 bg-white px-4 py-3.5 flex items-center gap-3 shadow-card">
            <CalendarRange className="w-5 h-5 text-brand-600 shrink-0" />
            <p className="text-sm font-semibold text-ink-900">
              {unseenAssignments.length} new job{unseenAssignments.length === 1 ? "" : "s"} added to your schedule
              {unseenAssignments.some((a) => a.workDate === todayKey) ? " — one of them is today." : "."}
            </p>
          </div>
        )}

        <NoticeBoard
          notices={notices.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            kind: n.kind,
            createdBy: n.createdBy,
            createdAt: String(n.createdAt),
          }))}
        />

        {celebrations.map((c) => (
          <div
            key={`${c.kind}-${c.date}`}
            className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3.5 flex items-center gap-3"
          >
            <PartyPopper className="w-5 h-5 text-brand-600 shrink-0" />
            <p className="text-sm font-semibold text-brand-900">
              {c.kind === "birthday"
                ? c.inDays === 0
                  ? "Happy birthday! The whole shop is wishing you a good one."
                  : `Your birthday is coming up ${c.inDays === 1 ? "tomorrow" : `in ${c.inDays} days`}.`
                : c.inDays === 0
                  ? `Congratulations on ${c.years} year${c.years === 1 ? "" : "s"} at Universal Driveshafts!`
                  : `You reach ${c.years} year${c.years === 1 ? "" : "s"} at Universal Driveshafts ${c.inDays === 1 ? "tomorrow" : `in ${c.inDays} days`}.`}
            </p>
          </div>
        ))}

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
                Everyone starts the month at {scoring.baseScore}. Your manager adjusts it — every change is listed
                below with the reason, so you always know what it was for.
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
                  {stats.bonus.eligible ? "You apply for bonuses" : "Bonuses — not qualified yet"}
                </h2>
                <p className="text-[13px] text-ink-600 mt-1">
                  Requires a score of {scoring.bonusScore}+
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
                    Keep it up through the end of {period.label}.
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
            tone={stats.attendance.punctuality >= 90 ? "good" : "warn"}
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

        <MyCalendar
          todayKey={todayKey}
          items={myAssignments.map((a) => ({
            id: a.id,
            workDate: a.workDate,
            startTime: a.startTime,
            type: a.type,
            title: a.title,
            customerName: a.customerName,
            details: a.details,
            entryId: a.entryId,
            status: a.status,
            isNew: !a.seenAt && a.status !== "cancelled",
          }))}
        />

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="font-bold flex items-center gap-2">
              <ClipboardList className="w-4.5 h-4.5 text-ink-400" /> My check-ins
            </h2>
            <NewCheckinButton className="h-9 px-3.5 text-[13px]" />
          </div>
          <p className="text-[13px] text-ink-500 mb-4">
            Work orders you took at the counter — {stats.jobs.created} this month.
          </p>
          <div className="divide-y divide-ink-100 -mx-5">
            {myCheckins.map((c) => (
              <Link
                key={c.id}
                href={`/entry/${c.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-ink-50 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900 truncate">
                    {c.firstName} {c.lastName}
                    {c.jobNumber ? <span className="text-ink-400 font-normal"> · Job {c.jobNumber}</span> : null}
                  </span>
                  <span className="block text-[13px] text-ink-500 truncate">
                    {[c.vehicleYear, c.vehicleMake, c.vehicleModel].filter(Boolean).join(" ") || "No vehicle"} ·{" "}
                    {formatDateTime(c.createdAt)}
                  </span>
                </span>
                <StatusBadge status={c.jobStatus} />
              </Link>
            ))}
            {myCheckins.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-ink-400">
                You have not taken a check-in yet.
              </p>
            )}
          </div>
        </Card>

        <MyRequests
          requests={myRequests.map((r) => ({
            id: r.id,
            type: r.type,
            subject: r.subject,
            status: r.status,
            requestedDate: r.requestedDate,
            lastMessageAt: String(r.lastMessageAt),
            unreadForUser: r.unreadForUser,
          }))}
        />

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Ledger */}
          <Card className="p-5">
            <h2 className="font-bold mb-1 flex items-center gap-2">
              <ClipboardList className="w-4.5 h-4.5 text-ink-400" /> Performance record
            </h2>
            <p className="text-[13px] text-ink-500 mb-4">
              Every change to your score, newest first — nothing is added by the system.
            </p>
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
                      {e.entryId ? ` · JOB${e.entryId}` : ""}
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
      </div>
    </AppShell>
  );
}
