import Link from "next/link";
import { ClipboardList, Settings, Wrench } from "lucide-react";
import { count, eq, gte } from "drizzle-orm";
import { getDb, entries } from "@/db";
import { getSettings } from "@/lib/settings";
import { IdleLock } from "@/components/idle-lock";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getDb();
  const s = await getSettings();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayCount] = await db.select({ n: count() }).from(entries).where(gte(entries.createdAt, today));
  const [ongoingCount] = await db.select({ n: count() }).from(entries).where(eq(entries.jobStatus, "Ongoing"));
  const [holdCount] = await db.select({ n: count() }).from(entries).where(eq(entries.jobStatus, "On hold"));

  return (
    <main className="min-h-dvh flex flex-col">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />
      <header className="bg-ink-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
              <Wrench className="w-5.5 h-5.5" />
            </span>
            <div>
              <p className="font-bold leading-tight">{s.businessName}</p>
              <p className="text-xs text-ink-400">Check-In Station</p>
            </div>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors"
          >
            <Settings className="w-4 h-4" /> Admin
          </Link>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl text-center animate-fade-up">
          <div className="rounded-2xl bg-brand-600 text-white font-bold py-2.5 px-4 text-sm inline-block mb-8 shadow-sm">
            {s.turnaroundBanner}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink-900 mb-3">
            Driveshaft Repair Check-In
          </h1>
          <p className="text-ink-500 mb-10">
            Register a customer for a repair or custom driveshaft. The customer receives SMS updates at every stage.
          </p>
          <Link
            href="/checkin"
            className="inline-flex items-center justify-center gap-3 h-20 px-12 rounded-2xl bg-brand-600 text-white text-xl font-bold shadow-pop hover:bg-brand-700 active:scale-[0.98] transition-all"
          >
            <ClipboardList className="w-7 h-7" />
            Start New Check-In
          </Link>

          <div className="grid grid-cols-3 gap-4 mt-14 max-w-lg mx-auto">
            <Stat label="Today" value={todayCount.n} />
            <Stat label="Ongoing" value={ongoingCount.n} />
            <Stat label="On hold" value={holdCount.n} />
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-200/60 shadow-card px-4 py-4">
      <p className="text-3xl font-bold text-ink-900">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 mt-1">{label}</p>
    </div>
  );
}
