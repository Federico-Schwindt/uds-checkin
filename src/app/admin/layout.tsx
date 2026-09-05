import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "./nav";
import { IdleLock } from "@/components/idle-lock";
import { Logo } from "@/components/logo";
import { getSettings } from "@/lib/settings";
import { getSession } from "@/lib/session";

export const metadata = { title: "Admin | UDS Check-In" };
// Settings come from the database on every request.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The proxy already gates /admin; this is the second lock on the door.
  const session = await getSession();
  if (!session) redirect("/lock?next=/admin");
  if (session.role !== "admin") redirect("/?denied=admin");

  const s = await getSettings();
  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-ink-100">
      <IdleLock minutes={Number(s.idleLockMinutes) || 0} />

      {/* Sidebar (desktop) / top bar (tablet & below) */}
      <aside className="lg:w-64 shrink-0 bg-ink-950 text-white lg:min-h-dvh no-print">
        <div className="px-4 sm:px-5 py-4 lg:py-6 flex items-center justify-between gap-3 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3">
            <Logo variant="white" className="h-6 lg:h-7" />
          </Link>
          <span className="text-[10px] text-ink-400 uppercase tracking-wider font-semibold">Admin</span>
        </div>
        <AdminNav userName={session.name} />
      </aside>

      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-3 sm:px-6 py-5 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
