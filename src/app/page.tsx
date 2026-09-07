import Link from "next/link";
import { redirect } from "next/navigation";
import { Gauge, LogOut, Settings } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { getDb, locations } from "@/db";
import { getSettings } from "@/lib/settings";
import { getSession } from "@/lib/session";
import { IdleLock } from "@/components/idle-lock";
import { Logo } from "@/components/logo";
import { EntriesWorkstation } from "@/components/entries-workstation";
import { SignOutButton } from "@/components/sign-out-button";
import { NewCheckinButton } from "@/components/new-checkin-button";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/lock");

  const db = await getDb();
  const s = await getSettings();
  const { denied } = await searchParams;
  const locs = await db.select().from(locations).where(eq(locations.active, true)).orderBy(asc(locations.id));
  const isAdmin = session.role === "admin";

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
            <span className="hidden lg:flex flex-col items-end leading-tight mr-1">
              <span className="text-[13px] font-bold text-ink-800">{session.name}</span>
              <span className="text-[11px] uppercase tracking-wide text-ink-400">
                {isAdmin ? "Administrator" : "Technician"}
              </span>
            </span>
            <NewCheckinButton />
            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 h-11 px-3 sm:px-4 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 text-sm font-semibold transition-colors"
              >
                <Settings className="w-4 h-4" /> <span className="max-sm:hidden">Admin</span>
              </Link>
            ) : (
              <Link
                href="/tech"
                className="inline-flex items-center gap-2 h-11 px-3 sm:px-4 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 text-sm font-semibold transition-colors"
              >
                <Gauge className="w-4 h-4" /> <span className="max-sm:hidden">My performance</span>
              </Link>
            )}
            <SignOutButton className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-ink-100 hover:bg-ink-200 text-ink-700 transition-colors">
              <LogOut className="w-4 h-4" />
            </SignOutButton>
          </div>
        </div>
      </header>

      <section className="flex-1 mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-5">
        {denied === "admin" && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            The admin panel is restricted to administrators. Ask your manager if you need access.
          </div>
        )}
        <EntriesWorkstation
          locations={locs.map((l) => ({ id: l.id, name: l.name }))}
          initialColumns={s.kioskColumns}
        />
      </section>

      {/* Always within thumb reach on a counter tablet. */}
      <NewCheckinButton variant="fab" />
    </main>
  );
}
