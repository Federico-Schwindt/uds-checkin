import { and, asc, eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { ScheduleBoard } from "./board";
import { getShopConfig } from "@/lib/settings";
import { todayKeyFor } from "@/lib/performance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedule | UDS Admin" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const config = await getShopConfig();
  const db = await getDb();
  const techs = await db
    .select({ id: users.id, name: users.name, title: users.title })
    .from(users)
    .where(and(eq(users.role, "tech"), eq(users.active, true)))
    .orderBy(asc(users.name));

  const today = todayKeyFor(config);
  const startMonth = /^\d{4}-\d{2}$/.test(month || "") ? (month as string) : today.slice(0, 7);

  return <ScheduleBoard technicians={techs} today={today} initialMonth={startMonth} />;
}
