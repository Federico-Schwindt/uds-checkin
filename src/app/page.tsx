import Link from "next/link";
import { ClipboardList, Settings, Wrench } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { getDb, locations } from "@/db";
import { getSettings } from "@/lib/settings";
import { IdleLock } from "@/components/idle-lock";
import { EntriesWorkstation } from "@/components/entries-workstation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getDb();
  const s = await getSettings();
  const locs = await db.select().from(locations).where(eq(locations.active, true)).orderBy(asc(locations.id));

  return (
    <main className="min-h-dvh flex flex-col">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />
      <header className="bg-ink-950 text-white no-print">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
              <Wrench className="w-5.5 h-5.5" />
            </span>
            <div className="min-w-0">
              <p className="font-bold leading-tight truncate">{s.businessName}</p>
              <p className="text-xs text-ink-400">Check-In Station · {s.turnaroundBanner}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/checkin"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-600 hover:bg-brand-500 text-sm font-bold shadow-sm active:scale-[0.98] transition-all"
            >
              <ClipboardList className="w-4.5 h-4.5" /> New Check-In
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors"
            >
              <Settings className="w-4 h-4" /> Admin
            </Link>
          </div>
        </div>
      </header>

      <section className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-5">
        <EntriesWorkstation
          locations={locs.map((l) => ({ id: l.id, name: l.name }))}
          initialColumns={s.kioskColumns}
        />
      </section>
    </main>
  );
}
