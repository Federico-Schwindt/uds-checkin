import Link from "next/link";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { ArrowUpRight } from "lucide-react";
import { getDb, entries, customers, messageLog } from "@/db";
import { StatusBadge, Card } from "@/components/ui";
import { formatDateTime, formatPhone } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const db = await getDb();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 29);

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

  // Last 14 days volume for the mini chart
  const daily = await db
    .select({
      day: sql<string>`to_char(${entries.createdAt}, 'YYYY-MM-DD')`,
      n: count(),
    })
    .from(entries)
    .where(and(live, gte(entries.createdAt, new Date(todayStart.getTime() - 13 * 86400_000))))
    .groupBy(sql`to_char(${entries.createdAt}, 'YYYY-MM-DD')`);
  const dailyMap = Object.fromEntries(daily.map((d) => [d.day, d.n]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(todayStart.getTime() - (13 - i) * 86400_000);
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString("en-US", { weekday: "short" }), n: dailyMap[key] || 0 };
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Check-ins today" value={today.n} />
        <Kpi label="Last 7 days" value={week.n} />
        <Kpi label="Last 30 days" value={month.n} />
        <Kpi label="Failed messages (7d)" value={smsFailed.n} tone={smsFailed.n > 0 ? "bad" : "good"} />
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
            <span>{days[0].key.slice(5)}</span>
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
