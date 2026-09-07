import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { getSettings, toShopConfig } from "@/lib/settings";
import { checkWorkHours, describeWorkHours, isShopOpen } from "@/lib/work-hours";

/**
 * Profiles shown on the sign-in screen. Public by design (it is the equivalent of
 * the user list on a shared workstation) — names only, never password material.
 */
export async function GET() {
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      title: users.title,
      bypassWorkHours: users.bypassWorkHours,
    })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.role), asc(users.name));

  const config = toShopConfig(await getSettings());
  const now = new Date();
  const check = checkWorkHours(now, config.workHours, {
    timezone: config.timezone,
    earlyMinutes: config.earlyLoginMinutes,
    lateMinutes: config.lateLoginMinutes,
  });

  return NextResponse.json({
    profiles: rows.map((r) => ({
      name: r.name,
      username: r.username,
      role: r.role,
      title: r.title,
      /** Whether this profile can sign in right now. */
      canSignIn: r.role === "admin" || r.bypassWorkHours || check.allowed,
    })),
    shop: {
      open: isShopOpen(now, config.workHours, config.timezone),
      signInAllowed: check.allowed,
      reason: check.reason,
      schedule: describeWorkHours(config.workHours),
    },
  });
}
