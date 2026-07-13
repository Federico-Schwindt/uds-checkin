import Link from "next/link";
import { Wrench } from "lucide-react";
import { AdminNav } from "./nav";
import { IdleLock } from "@/components/idle-lock";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Admin | UDS Check-In" };
// Settings come from the database on every request.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />

      {/* Sidebar (desktop) / top bar (tablet & below) */}
      <aside className="lg:w-64 shrink-0 bg-ink-950 text-white lg:min-h-dvh no-print">
        <div className="px-5 py-4 lg:py-6 flex items-center gap-3 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center group-hover:bg-brand-500 transition-colors">
              <Wrench className="w-5 h-5" />
            </span>
            <span>
              <span className="block font-bold leading-tight text-[15px]">{s.businessName}</span>
              <span className="block text-[11px] text-ink-400 uppercase tracking-wider">Admin Panel</span>
            </span>
          </Link>
        </div>
        <AdminNav />
      </aside>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
