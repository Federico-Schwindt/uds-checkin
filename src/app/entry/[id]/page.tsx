import Link from "next/link";
import { Wrench } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { EntryDetail } from "@/components/entry-detail";
import { IdleLock } from "@/components/idle-lock";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entry | UDS Check-In" };

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSettings();
  return (
    <main className="min-h-dvh">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />
      <header className="bg-ink-950 text-white no-print">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center group-hover:bg-brand-500 transition-colors">
              <Wrench className="w-5 h-5" />
            </span>
            <span className="font-bold">{s.businessName}</span>
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <EntryDetail id={parseInt(id)} basePath="/entry" backHref="/" backLabel="Back to entries" />
      </div>
    </main>
  );
}
