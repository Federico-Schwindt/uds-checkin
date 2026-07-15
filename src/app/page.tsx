import Link from "next/link";
import { ClipboardList, Settings } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { getDb, locations } from "@/db";
import { getSettings } from "@/lib/settings";
import { IdleLock } from "@/components/idle-lock";
import { Logo } from "@/components/logo";
import { EntriesWorkstation } from "@/components/entries-workstation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = await getDb();
  const s = await getSettings();
  const locs = await db.select().from(locations).where(eq(locations.active, true)).orderBy(asc(locations.id));

  return (
    <main className="min-h-dvh flex flex-col bg-ink-100">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />
      <header className="bg-white border-b border-ink-200 sticky top-0 z-20 no-print">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo className="h-7 sm:h-9" />
            <span className="hidden md:block text-sm text-ink-400 border-l border-ink-200 pl-3">
              Check-In Station
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/checkin"
              className="inline-flex items-center gap-2 h-11 px-4 sm:px-5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-sm active:scale-[0.98] transition-all"
            >
              <ClipboardList className="w-4.5 h-4.5" /> <span className="max-sm:hidden">New Check-In</span>
              <span className="sm:hidden">New</span>
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 h-11 px-3 sm:px-4 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 text-sm font-semibold transition-colors"
            >
              <Settings className="w-4 h-4" /> <span className="max-sm:hidden">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      <section className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-5">
        <EntriesWorkstation
          locations={locs.map((l) => ({ id: l.id, name: l.name }))}
          initialColumns={s.kioskColumns}
        />
      </section>
    </main>
  );
}
