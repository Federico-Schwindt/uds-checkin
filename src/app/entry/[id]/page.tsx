import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { EntryDetail } from "@/components/entry-detail";
import { IdleLock } from "@/components/idle-lock";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entry | UDS Check-In" };

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSettings();
  return (
    <main className="min-h-dvh bg-ink-100">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />
      <header className="bg-white border-b border-ink-200 sticky top-0 z-20 no-print">
        <div className="mx-auto max-w-6xl px-3 sm:px-6 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="h-7 sm:h-8" />
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-3 sm:px-6 py-4 sm:py-6">
        <EntryDetail id={parseInt(id)} basePath="/entry" backHref="/" backLabel="Back to entries" />
      </div>
    </main>
  );
}
