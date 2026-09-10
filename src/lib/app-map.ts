/**
 * What every screen in this app is for, in one place.
 *
 * The sidebar, the context bar above each page and the employee guide all read
 * from here, so a screen can never be labelled one way in the nav and another
 * way in the guide — and adding a screen means writing its purpose once.
 */

export type ScreenGroup = "daily" | "people" | "records";

export type Screen = {
  href: string;
  /** Short label for the nav. */
  label: string;
  /** One line: what you come to this screen to do. */
  purpose: string;
  group: ScreenGroup;
  /** Admin screens are hidden from technicians entirely. */
  admin?: boolean;
  /** Matches only the exact path, for parents of other routes. */
  exact?: boolean;
};

export const GROUP_LABEL: Record<ScreenGroup, string> = {
  daily: "Day to day",
  people: "People",
  records: "Records & setup",
};

/** The shop-floor screens, shared by everyone who signs in. */
export const FLOOR_SCREENS: Screen[] = [
  {
    href: "/",
    label: "Jobs",
    purpose: "Every check-in and work order in the shop. Search it, filter it, and edit any field without leaving the list.",
    group: "daily",
    exact: true,
  },
  {
    href: "/tech",
    label: "My panel",
    purpose: "Your score for the month, what your manager booked for you, notices from the shop, and your requests.",
    group: "daily",
  },
  {
    href: "/help",
    label: "Guide",
    purpose: "How every part of this app works, screen by screen, with pictures.",
    group: "daily",
  },
];

/** The admin sidebar, in the order it is shown. */
export const ADMIN_SCREENS: Screen[] = [
  {
    href: "/admin",
    label: "Dashboard",
    purpose: "The shop at a glance: what came in today, what needs attention, who is behind, and who arrived late.",
    group: "daily",
    admin: true,
    exact: true,
  },
  {
    href: "/admin/entries",
    label: "Entries",
    purpose: "Search and export every job ever taken, with filters for status, payment and date range.",
    group: "daily",
    admin: true,
  },
  {
    href: "/admin/schedule",
    label: "Schedule",
    purpose: "Book a technician onto a job, an appointment or a task. What you add here shows on their panel.",
    group: "daily",
    admin: true,
  },
  {
    href: "/admin/team",
    label: "Team",
    purpose: "Everyone's score for the month, their PIN, birthdays and start dates. Scores only move from here.",
    group: "people",
    admin: true,
  },
  {
    href: "/admin/attendance",
    label: "Attendance",
    purpose: "The first sign-in of each person each day, and how late it was against their shift.",
    group: "people",
    admin: true,
  },
  {
    href: "/admin/requests",
    label: "Requests",
    purpose: "Time off, extra hours and anything else the team asks for. Emailed out, and replies land back here.",
    group: "people",
    admin: true,
  },
  {
    href: "/admin/announcements",
    label: "Notices",
    purpose: "Post something the whole team has to read — a closure, a schedule change — and see who has read it.",
    group: "people",
    admin: true,
  },
  {
    href: "/admin/activity",
    label: "Who did what",
    purpose: "Every change anyone has made, in plain language, with the name of the person who made it.",
    group: "records",
    admin: true,
  },
  {
    href: "/admin/messages",
    label: "Message Log",
    purpose: "Every text and email the app sent a customer, and whether it went through.",
    group: "records",
    admin: true,
  },
  {
    href: "/admin/form",
    label: "Form Builder",
    purpose: "Change the questions on the check-in form — add a field, reword one, or drop one.",
    group: "records",
    admin: true,
  },
  {
    href: "/admin/templates",
    label: "Notifications",
    purpose: "The wording of the texts and emails customers get when a job changes status.",
    group: "records",
    admin: true,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    purpose: "Working hours, scoring rules, locations, and the accounts that send mail and texts.",
    group: "records",
    admin: true,
  },
  {
    href: "/admin/import",
    label: "Import",
    purpose: "Bring old jobs in from a Gravity Forms export.",
    group: "records",
    admin: true,
  },
];

export const ALL_SCREENS = [...FLOOR_SCREENS, ...ADMIN_SCREENS];

/** The screen a path belongs to — longest match wins, so /admin/team/3 finds Team. */
export function screenFor(pathname: string): Screen | undefined {
  let best: Screen | undefined;
  for (const s of ALL_SCREENS) {
    const hit = s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`);
    if (hit && (!best || s.href.length > best.href.length)) best = s;
  }
  return best;
}

export function groupedAdminScreens(): { group: ScreenGroup; screens: Screen[] }[] {
  return (["daily", "people", "records"] as const)
    .map((group) => ({ group, screens: ADMIN_SCREENS.filter((s) => s.group === group) }))
    .filter((g) => g.screens.length > 0);
}
