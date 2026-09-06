import Link from "next/link";
import { AlertTriangle, ArrowUpRight, BadgeCheck, Clock, Users } from "lucide-react";
import { Card } from "@/components/ui";
import { GradeChip, StatTile } from "@/components/performance-ui";
import { TeamAccounts } from "./accounts";
import { getShopConfig } from "@/lib/settings";
import { currentPeriod, getTeamStats } from "@/lib/performance";
import { arrivalLabel } from "@/lib/attendance";
import { monthRange } from "@/lib/work-hours";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team | UDS Admin" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const config = await getShopConfig();
  const period = /^\d{4}-\d{2}$/.test(month || "") ? monthRange(`${month}-01`) : currentPeriod(new Date(), config);
  const team = await getTeamStats(config, period, { includeInactive: true });
  const active = team.filter((t) => t.active);

  const avgScore = active.length ? Math.round(active.reduce((s, t) => s + t.score, 0) / active.length) : 0;
  const avgPunctuality = active.length
    ? Math.round(active.reduce((s, t) => s + t.attendance.punctuality, 0) / active.length)
    : 0;
  const bonusReady = active.filter((t) => t.bonus.eligible).length;
  const flagged = active.reduce((s, t) => s + t.events.minor + t.events.major + t.events.critical, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team performance</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            {period.label} · scores, punctuality and bonus eligibility for every technician
          </p>
        </div>
        <Link
          href="/admin/attendance"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800"
        >
          Attendance board <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Team average score" value={avgScore} tone={avgScore >= 90 ? "good" : avgScore >= 75 ? "ok" : "warn"} />
        <StatTile
          label="Average punctuality"
          value={`${avgPunctuality}%`}
          tone={avgPunctuality >= 90 ? "good" : "warn"}
        />
        <StatTile
          label="Can apply for bonuses"
          value={`${bonusReady}/${active.length}`}
          hint={`Score ${config.scoring.bonusScore}+ this month`}
          tone={bonusReady > 0 ? "good" : "warn"}
        />
        <StatTile label="Mistakes flagged" value={flagged} tone={flagged === 0 ? "good" : "bad"} />
      </div>

      {/* Scorecards */}
      <div className="grid lg:grid-cols-2 gap-4">
        {team.map((t) => (
          <Link
            key={t.userId}
            href={`/admin/team/${t.userId}`}
            className="block rounded-2xl border border-ink-200/60 bg-white shadow-card p-5 hover:border-brand-400 hover:shadow-pop transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink-900 truncate flex items-center gap-2">
                  {t.name}
                  {!t.active && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400 border border-ink-300 rounded px-1.5 py-0.5">
                      Inactive
                    </span>
                  )}
                </p>
                <p className="text-[13px] text-ink-500 truncate">{t.title || "Technician"}</p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={
                    "text-3xl font-bold leading-none " +
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
                </p>
                <GradeChip score={t.score} className="mt-1.5" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              <Metric label="On time" value={`${t.attendance.punctuality}%`} />
              <Metric label="Late" value={t.attendance.late} tone={t.attendance.late > 0 ? "warn" : undefined} />
              <Metric label="Missed" value={t.attendance.missed} tone={t.attendance.missed > 0 ? "bad" : undefined} />
              <Metric
                label="Mistakes"
                value={t.events.minor + t.events.major + t.events.critical}
                tone={t.events.critical > 0 ? "bad" : t.events.major > 0 ? "warn" : undefined}
              />
            </div>

            <div className="mt-4 pt-3 border-t border-ink-100 flex items-center gap-2 text-[13px]">
              <Clock className="w-4 h-4 text-ink-400 shrink-0" />
              <span className="text-ink-600">
                Avg arrival {arrivalLabel(t.attendance.avgArrivalMinutes)} · {t.jobs.created} check-ins ·{" "}
                {t.jobs.completed} completed
              </span>
            </div>

            <div
              className={
                "mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold " +
                (t.bonus.eligible
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-800")
              }
            >
              {t.bonus.eligible ? (
                <>
                  <BadgeCheck className="w-4 h-4 shrink-0" /> Applies for bonuses
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t.bonus.blockers[0]}</span>
                </>
              )}
            </div>
          </Link>
        ))}
        {team.length === 0 && (
          <Card className="p-8 text-center text-ink-500 lg:col-span-2">
            <Users className="w-8 h-8 mx-auto mb-2 text-ink-300" />
            No technician profiles yet. Add one below.
          </Card>
        )}
      </div>

      <TeamAccounts />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-lg bg-ink-50 py-2">
      <p
        className={
          "text-lg font-bold leading-none " +
          (tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-ink-900")
        }
      >
        {value}
      </p>
      <p className="text-[11px] font-medium text-ink-500 mt-1">{label}</p>
    </div>
  );
}
