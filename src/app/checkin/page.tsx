import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSettings } from "@/lib/settings";
import { CheckinWizard } from "@/components/checkin/wizard";
import { IdleLock } from "@/components/idle-lock";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Check-In | UDS" };

export default async function CheckinPage() {
  const s = await getSettings();
  return (
    <main className="min-h-dvh">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />
      <header className="bg-ink-950 text-white no-print">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <span className="font-bold">{s.businessName} — Check-In</span>
        </div>
      </header>
      <CheckinWizard turnaroundBanner={s.turnaroundBanner} />
    </main>
  );
}
