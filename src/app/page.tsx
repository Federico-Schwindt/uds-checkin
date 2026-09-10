import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, locations } from "@/db";
import { getSettingsCached } from "@/lib/settings";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { IdleLock } from "@/components/idle-lock";
import { EntriesWorkstation } from "@/components/entries-workstation";
import { NewCheckinButton } from "@/components/new-checkin-button";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/lock");

  const db = await getDb();
  const [s, { denied }, locs] = await Promise.all([
    getSettingsCached(),
    searchParams,
    db.select().from(locations).where(eq(locations.active, true)).orderBy(asc(locations.id)),
  ]);

  return (
    <AppShell session={session} active="/" wide actions={<NewCheckinButton className="h-10 px-4 text-sm" />}>
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />

      {denied === "admin" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          The admin panel is restricted to administrators. Ask your manager if you need access.
        </div>
      )}

      <EntriesWorkstation
        locations={locs.map((l) => ({ id: l.id, name: l.name }))}
        initialColumns={s.kioskColumns}
      />

      {/* Always within thumb reach on a counter tablet. */}
      <NewCheckinButton variant="fab" />
    </AppShell>
  );
}
