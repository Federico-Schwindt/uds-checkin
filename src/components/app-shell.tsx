import Link from "next/link";
import { Briefcase, BookOpen, Gauge, LogOut, Settings } from "lucide-react";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { FLOOR_SCREENS, type Screen } from "@/lib/app-map";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Gauge> = {
  "/": Briefcase,
  "/tech": Gauge,
  "/help": BookOpen,
};

/**
 * The chrome every signed-in screen sits in.
 *
 * A dark bar with the same few destinations on every page, then a strip that
 * names the screen and says in one line what it is for — so nobody has to work
 * out what they are looking at. The admin panel wears the same bar on its
 * sidebar; this is the shop-floor half of it.
 */
export function AppShell({
  session,
  active,
  actions,
  children,
  wide,
}: {
  session: { name: string; role: string };
  /** href of the current screen, as listed in FLOOR_SCREENS. */
  active: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** The jobs table wants the full width; the panels read better narrower. */
  wide?: boolean;
}) {
  const isAdmin = session.role === "admin";
  const screens = FLOOR_SCREENS.filter((s) => (s.href === "/tech" ? !isAdmin : true));
  const current = FLOOR_SCREENS.find((s) => s.href === active);
  const container = wide ? "max-w-7xl" : "max-w-5xl";

  return (
    <div className="min-h-dvh flex flex-col bg-ink-100">
      <header className="bg-ink-950 text-white sticky top-0 z-20 no-print">
        <div className={cn("mx-auto w-full px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-4", container)}>
          {/* The wordmark is 6:1 — on a phone it would crowd out the tabs. */}
          <Link href="/" className="hidden sm:flex items-center gap-2.5 shrink-0" title="UDS Check-In">
            <Logo variant="white" className="h-6" />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 border-l border-white/15 pl-2.5">
              Check-In
            </span>
          </Link>

          <nav className="flex items-center gap-0.5 sm:gap-1 min-w-0 overflow-x-auto no-scrollbar">
            {screens.map((s) => (
              <NavTab key={s.href} screen={s} active={s.href === active} />
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap text-ink-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4 shrink-0" />
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <span className="hidden md:flex flex-col items-end leading-tight">
              <span className="text-[12px] font-bold text-white">{session.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-ink-500">
                {isAdmin ? "Administrator" : "Technician"}
              </span>
            </span>
            <SignOutButton
              className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-ink-300 hover:bg-white/10 hover:text-white transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </SignOutButton>
          </div>
        </div>
      </header>

      {current && (
        <div className="bg-white border-b border-ink-200 no-print">
          <div className={cn("mx-auto w-full px-3 sm:px-6 py-2.5 sm:py-3.5", container)}>
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-ink-900 leading-tight truncate">
                {current.label}
              </h1>
              {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>
            <p className="text-[12.5px] sm:text-[13px] text-ink-500 mt-0.5 max-w-3xl">{current.purpose}</p>
          </div>
        </div>
      )}

      <main className={cn("flex-1 mx-auto w-full px-3 sm:px-6 py-4 sm:py-5", container)}>{children}</main>
    </div>
  );
}

function NavTab({ screen, active }: { screen: Screen; active: boolean }) {
  const Icon = ICONS[screen.href] ?? Briefcase;
  return (
    <Link
      href={screen.href}
      title={screen.purpose}
      className={cn(
        "flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors",
        active ? "bg-white/12 text-white" : "text-ink-300 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {screen.label}
    </Link>
  );
}

/**
 * Names a section inside a page and says what it does. Used wherever a card
 * needs more than a heading to be obvious.
 */
export function SectionIntro({
  title,
  purpose,
  icon: Icon,
  actions,
  className,
}: {
  title: string;
  purpose?: string;
  icon?: typeof Gauge;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 flex-wrap", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-ink-900">
          {Icon && <Icon className="w-4.5 h-4.5 text-brand-600 shrink-0" />}
          {title}
        </h2>
        {purpose && <p className="text-[13px] text-ink-500 mt-0.5">{purpose}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
