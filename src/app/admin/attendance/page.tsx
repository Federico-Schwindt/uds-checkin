import Link from "next/link";
import { and, gte, inArray, lte } from "drizzle-orm";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, UserX } from "lucide-react";
import { attendance, getDb } from "@/db";
import { Card } from "@/components/ui";
import { StatTile } from "@/components/performance-ui";
import { getShopConfig } from "@/lib/settings";
import { getDayBoard, todayKeyFor } from "@/lib/performance";
import { arrivalLabel, latenessLabel } from "@/lib/attendance";
import {
  addDays,
  DAY_NAMES,
  formatClock,
  formatDateKey,
  openDaysBetween,
  parseHhMm,
  scheduleForDay,
  weekdayOf,
} from "@/lib/work-hours";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attendance | UDS Admin" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const config = await getShopConfig();
  const today = todayKeyFor(config);
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? (date as string) : today;

  const board = await getDayBoard(dateKey);
  const schedule = scheduleForDay(config.workHours, weekdayOf(dateKey));

  // Last 14 open days, for the trend strip.
  const windowStart = addDays(dateKey, -27);
  const recentDays = openDaysBetween(config.workHours, windowStart, dateKey).slice(-14);
  const db = await getDb();
  const techIds = board.map((b) => b.user.id);
  const history = techIds.length
    ? await db
        .select()
        .from(attendance)
        .where(
          and(
            inArray(attendance.userId, techIds),
            gte(attendance.workDate, recentDays[0] || dateKey),
            lte(attendance.workDate, dateKey)
          )
        )
    : [];

  const present = board.filter((b) => b.record).length;
  const late = board.filter((b) => b.record?.late).length;
  const missing = board.filter((b) => !b.record).length;
  const isToday = dateKey === today;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {DAY_NAMES[weekdayOf(dateKey)]}, {formatDateKey(dateKey, { month: "long", day: "numeric", year: "numeric" })}
            {" · "}
            {schedule.open
              ? `shift ${formatClock(parseHhMm(schedule.start))}–${formatClock(parseHhMm(schedule.end))}`
              : "shop closed"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/attendance?date=${addDays(dateKey, -1)}`}
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-ink-300 bg-white text-ink-700 hover:bg-ink-50"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          {!isToday && (
            <Link
              href="/admin/attendance"
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-ink-300 bg-white text-sm font-semibold text-ink-700 hover:bg-ink-50"
            >
              <CalendarDays className="w-4 h-4" /> Today
            </Link>
          )}
          <Link
            href={`/admin/attendance?date=${addDays(dateKey, 1)}`}
            className={
              "inline-flex items-center justify-center h-10 w-10 rounded-xl border border-ink-300 bg-white text-ink-700 hover:bg-ink-50 " +
              (dateKey >= today ? "pointer-events-none opacity-40" : "")
            }
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Signed in" value={`${present}/${board.length}`} tone={present === board.length ? "good" : "warn"} />
        <StatTile label="On time" value={present - late} tone="good" />
        <StatTile label="Late" value={late} tone={late === 0 ? "good" : "warn"} />
        <StatTile
          label={schedule.open ? "Not in yet" : "Shop closed"}
          value={schedule.open ? missing : "—"}
          tone={schedule.open && missing > 0 ? "bad" : "good"}
        />
      </div>

      <Card className="p-5">
        <h2 className="font-bold mb-4">Who is in</h2>
        <div className="divide-y divide-ink-100 -mx-5">
          {board.map(({ user, record }) => (
            <div key={user.id} className="px-5 py-3.5 flex items-center gap-3">
              <span
                className={
                  "w-2.5 h-2.5 rounded-full shrink-0 " +
                  (!record ? "bg-ink-300" : record.late ? "bg-amber-500" : "bg-emerald-500")
                }
              />
              <div className="min-w-0 flex-1">
                <Link href={`/admin/team/${user.id}`} className="font-semibold text-ink-900 hover:text-brand-700">
                  {user.name}
                </Link>
                <p className="text-[13px] text-ink-500">{user.title || "Technician"}</p>
              </div>
              {record ? (
                <>
                  <span className="text-sm text-ink-700 tabular-nums flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-ink-300" />
                    {arrivalLabel(record.arrivalMinutes)}
                  </span>
                  <span
                    className={
                      "text-[13px] font-semibold w-28 text-right " +
                      (record.late ? "text-amber-600" : "text-emerald-600")
                    }
                  >
                    {latenessLabel(record)}
                  </span>
                </>
              ) : (
                <span className="text-[13px] font-semibold text-ink-400 flex items-center gap-1.5">
                  <UserX className="w-4 h-4" />
                  {schedule.open ? "No sign-in" : "Off"}
                </span>
              )}
            </div>
          ))}
          {board.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-400">No active technicians.</p>
          )}
        </div>
      </Card>

      {/* Trend strip */}
      <Card className="p-5 overflow-x-auto">
        <h2 className="font-bold mb-1">Arrival pattern</h2>
        <p className="text-[13px] text-ink-500 mb-4">Last {recentDays.length} working days · green on time, amber late, grey no sign-in.</p>
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
              <th className="text-left py-2 pr-3">Technician</th>
              {recentDays.map((d) => (
                <th key={d} className="py-2 px-1 font-medium whitespace-nowrap">
                  {formatDateKey(d, { month: "numeric", day: "numeric" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {board.map(({ user }) => (
              <tr key={user.id} className="border-t border-ink-100">
                <td className="py-2.5 pr-3 font-semibold text-ink-800 whitespace-nowrap">{user.name}</td>
                {recentDays.map((d) => {
                  const rec = history.find((h) => h.userId === user.id && h.workDate === d);
                  return (
                    <td key={d} className="py-2.5 px-1 text-center">
                      <span
                        title={rec ? `${arrivalLabel(rec.arrivalMinutes)} — ${latenessLabel(rec)}` : "No sign-in"}
                        className={
                          "inline-block w-6 h-6 rounded-md " +
                          (!rec ? "bg-ink-200" : rec.late ? "bg-amber-400" : "bg-emerald-500")
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
