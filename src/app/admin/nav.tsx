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
  CalendarRange,
  Inbox,
  Megaphone,
  Users,
  Briefcase,
  BookOpen,
} from "lucide-react";
import { GROUP_LABEL, groupedAdminScreens } from "@/lib/app-map";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Settings> = {
  "/admin": LayoutDashboard,
  "/admin/entries": ClipboardList,
  "/admin/schedule": CalendarRange,
  "/admin/team": Users,
  "/admin/attendance": CalendarClock,
  "/admin/requests": Inbox,
  "/admin/announcements": Megaphone,
  "/admin/activity": History,
  "/admin/messages": MailCheck,
  "/admin/form": ListChecks,
  "/admin/templates": MessageSquareText,
  "/admin/settings": Settings,
  "/admin/import": Upload,
};

export function AdminNav({ userName }: { userName?: string }) {
  const pathname = usePathname();
  const groups = groupedAdminScreens();

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/lock";
  };

  return (
    <nav className="px-3 py-3 lg:py-4 lg:flex-1 flex lg:flex-col gap-1 lg:gap-0 overflow-x-auto lg:overflow-visible">
      {groups.map(({ group, screens }) => (
        <div key={group} className="contents lg:block lg:mb-3">
          {/* The labels only earn their space in the vertical sidebar. */}
          <p className="max-lg:hidden px-3.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-500">
            {GROUP_LABEL[group]}
          </p>
          {screens.map((s) => {
            const Icon = ICONS[s.href] ?? Briefcase;
            const active = s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`);
            return (
              <Link
                key={s.href}
                href={s.href}
                title={s.purpose}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors",
                  active ? "bg-brand-600 text-white" : "text-ink-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {s.label}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="lg:mt-auto lg:pt-3 lg:border-t lg:border-white/10 contents lg:block">
        <Link
          href="/"
          title="The jobs list every technician works from"
          className="flex items-center gap-3 px-3.5 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap text-ink-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <Briefcase className="w-4 h-4 shrink-0" />
          Jobs
        </Link>
        <Link
          href="/help"
          title="How every part of this app works, with pictures"
          className="flex items-center gap-3 px-3.5 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap text-ink-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <BookOpen className="w-4 h-4 shrink-0" />
          Guide
        </Link>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-[13px] font-semibold whitespace-nowrap text-ink-300 hover:bg-white/10 hover:text-white transition-colors"
          title={userName ? `Signed in as ${userName}` : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out{userName ? <span className="text-ink-500 font-normal max-lg:hidden">· {userName}</span> : null}
        </button>
      </div>
    </nav>
  );
}
