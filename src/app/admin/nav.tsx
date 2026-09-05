"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  ListChecks,
  MessageSquareText,
  MailCheck,
  History,
  Settings,
  Upload,
  LogOut,
  CalendarClock,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/entries", label: "Entries", icon: ClipboardList },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarClock },
  { href: "/admin/form", label: "Form Builder", icon: ListChecks },
  { href: "/admin/templates", label: "Notifications", icon: MessageSquareText },
  { href: "/admin/messages", label: "Message Log", icon: MailCheck },
  { href: "/admin/activity", label: "Activity Log", icon: History },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/import", label: "Import", icon: Upload },
];

export function AdminNav({ userName }: { userName?: string }) {
  const pathname = usePathname();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/lock";
  };

  return (
    <nav className="px-3 py-3 lg:py-4 flex lg:flex-col gap-1 overflow-x-auto">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors",
              active ? "bg-brand-600 text-white" : "text-ink-300 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon className="w-4.5 h-4.5 shrink-0" />
            {label}
          </Link>
        );
      })}
      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap text-ink-300 hover:bg-white/10 hover:text-white transition-colors lg:mt-auto"
        title={userName ? `Signed in as ${userName}` : undefined}
      >
        <LogOut className="w-4.5 h-4.5 shrink-0" />
        Sign out{userName ? <span className="text-ink-500 font-normal max-lg:hidden">· {userName}</span> : null}
      </button>
    </nav>
  );
}
