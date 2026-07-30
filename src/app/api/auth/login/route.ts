import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, createSessionToken } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
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

  const { pin } = await req.json().catch(() => ({ pin: "" }));
  const s = await getSettings();
  if (!pin || String(pin) !== String(s.pin)) {
    await logActivity({ action: "auth.failed", entity: "auth", summary: "Failed PIN unlock attempt", req });
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const days = Number(s.sessionDays) || 30;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, createSessionToken(days), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: days * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
