import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken, type Session } from "@/lib/auth";

/** Session for a server component or server action. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(AUTH_COOKIE)?.value);
}

/** Session inside a route handler — reads the cookie straight off the request. */
export function sessionFromRequest(req: NextRequest): Session | null {
  return verifySessionToken(req.cookies.get(AUTH_COOKIE)?.value);
}

export function isAdminRequest(req: NextRequest): boolean {
  return sessionFromRequest(req)?.role === "admin";
}
