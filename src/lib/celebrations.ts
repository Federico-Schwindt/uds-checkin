import { asc, eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { formatDateKey } from "@/lib/work-hours";

export type Celebration = {
  userId: number;
  name: string;
  kind: "birthday" | "anniversary";
  /** The day it falls on this year, "YYYY-MM-DD". */
  date: string;
  /** 0 = today, 1 = tomorrow … */
  inDays: number;
  /** Years of service; undefined for birthdays (we don't publish ages). */
  years?: number;
};

/** Moves a stored date onto the calendar year that `todayKey` sits in. */
function nextOccurrence(stored: string, todayKey: string): { date: string; inDays: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stored)) return null;
  const monthDay = stored.slice(5);
  const year = parseInt(todayKey.slice(0, 4), 10);
  // Feb 29 in a common year is celebrated on Mar 1.
  const normalize = (y: number) => {
    const candidate = `${y}-${monthDay}`;
    const d = new Date(`${candidate}T00:00:00Z`);
    if (isNaN(d.getTime())) return `${y}-03-01`;
    return candidate;
  };
  let date = normalize(year);
  if (date < todayKey) date = normalize(year + 1);
  const inDays = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86_400_000
  );
  return { date, inDays };
}

/** Birthdays and work anniversaries falling within the next `leadDays`. */
export async function upcomingCelebrations(todayKey: string, leadDays = 7): Promise<Celebration[]> {
  const db = await getDb();
  const staff = await db
    .select({ id: users.id, name: users.name, birthday: users.birthday, hiredOn: users.hiredOn })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));

  const out: Celebration[] = [];
  for (const u of staff) {
    const bday = nextOccurrence(u.birthday, todayKey);
    if (bday && bday.inDays <= leadDays) {
      out.push({ userId: u.id, name: u.name, kind: "birthday", date: bday.date, inDays: bday.inDays });
    }
    const hire = nextOccurrence(u.hiredOn, todayKey);
    if (hire && hire.inDays <= leadDays) {
      const years = parseInt(hire.date.slice(0, 4), 10) - parseInt(u.hiredOn.slice(0, 4), 10);
      // The hire date itself is not an anniversary.
      if (years > 0) {
        out.push({ userId: u.id, name: u.name, kind: "anniversary", date: hire.date, inDays: hire.inDays, years });
      }
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

/** "today", "tomorrow", "on Fri, Sep 11" */
export function whenLabel(inDays: number, date: string): string {
  if (inDays === 0) return "today";
  if (inDays === 1) return "tomorrow";
  return `on ${formatDateKey(date, { weekday: "short", month: "short", day: "numeric" })}`;
}

export function celebrationText(c: Celebration): string {
  const when = whenLabel(c.inDays, c.date);
  if (c.kind === "birthday") return `${c.name}'s birthday is ${when}`;
  return `${c.name} celebrates ${c.years} year${c.years === 1 ? "" : "s"} at the shop ${when}`;
}

/** Someone's own celebration inside the window, for their panel. */
export async function myCelebration(userId: number, todayKey: string, leadDays = 7): Promise<Celebration[]> {
  const all = await upcomingCelebrations(todayKey, leadDays);
  return all.filter((c) => c.userId === userId);
}
