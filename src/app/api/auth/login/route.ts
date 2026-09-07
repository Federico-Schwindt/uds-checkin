import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, users } from "@/db";
import { AUTH_COOKIE, createSessionToken, type Role } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { getSettings, toShopConfig } from "@/lib/settings";
import { checkWorkHours, shiftEndTimestamp } from "@/lib/work-hours";
import { recordArrival } from "@/lib/attendance";
import { logActivity } from "@/lib/audit";

// Simple in-memory throttle: 10 attempts per IP per minute.
const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && a.resetAt > now && a.count >= 10) {
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  if (!a || a.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
  } else {
    a.count++;
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || !password) {
    return NextResponse.json({ error: "Enter your username and password" }, { status: 400 });
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username));

  // Same message for unknown user and wrong password, so the form can't be used
  // to enumerate accounts.
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    await logActivity({
      action: "auth.failed",
      entity: "auth",
      summary: `Failed sign-in attempt for “${username}”`,
      req,
    });
    return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
  }

  const settings = await getSettings();
  const config = toShopConfig(settings);
  const role = (user.role === "admin" ? "admin" : "tech") as Role;
  const signedInAt = new Date();

  // Technicians may only badge in during the posted opening hours.
  if (role !== "admin" && !user.bypassWorkHours) {
    const check = checkWorkHours(signedInAt, config.workHours, {
      timezone: config.timezone,
      earlyMinutes: config.earlyLoginMinutes,
      lateMinutes: config.lateLoginMinutes,
    });
    if (!check.allowed) {
      await logActivity({
        action: "auth.outside_hours",
        entity: "auth",
        entityId: user.id,
        actor: user.name,
        summary: `${user.name} tried to sign in outside working hours`,
        details: { reason: check.reason },
        req,
      });
      return NextResponse.json({ error: check.reason, outsideHours: true }, { status: 403 });
    }
  }

  const expiresAt =
    role === "admin"
      ? Date.now() + (Number(settings.sessionDays) || 30) * 24 * 60 * 60 * 1000
      : shiftEndTimestamp(signedInAt, config.workHours, config.timezone, config.shiftSessionGraceMinutes);

  let arrival = null;
  try {
    arrival = await recordArrival(user.id, signedInAt, config);
  } catch (err) {
    // Never block a sign-in because the attendance row failed.
    console.error("attendance record failed", err);
  }

  await db.update(users).set({ lastLoginAt: signedInAt }).where(eq(users.id, user.id));

  if (arrival?.first) {
    await logActivity({
      action: "attendance.arrival",
      entity: "user",
      entityId: user.id,
      actor: user.name,
      summary: `${user.name} clocked in${arrival.late ? ` — ${arrival.minutesLate} min late` : ""}`,
      details: {
        workDate: arrival.dateKey,
        arrivalMinutes: arrival.arrivalMinutes,
        scheduledStart: arrival.scheduledStart,
        late: arrival.late,
      },
      req,
    });
  }

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, username: user.username, role },
    arrival,
    redirect: role === "admin" ? "/admin" : "/",
  });
  res.cookies.set(
    AUTH_COOKIE,
    createSessionToken({ uid: user.id, role, name: user.name, username: user.username, exp: expiresAt }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)),
      path: "/",
    }
  );
  return res;
}
