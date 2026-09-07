import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Reachable without a session. The inbound-mail routes are public because they
 * are called by a mail provider or a scheduler; each checks its own shared secret.
 */
const PUBLIC_PREFIXES = ["/lock", "/api/auth/", "/api/inbound/", "/manifest.webmanifest"];

/** Admin-only areas — technicians are bounced to the station. */
const ADMIN_PREFIXES = ["/admin", "/api/admin"];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = verifySessionToken(req.cookies.get(AUTH_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");

  if (!session) {
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL("/lock", req.nextUrl);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const wantsAdmin = ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (wantsAdmin && session.role !== "admin") {
    if (isApi) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    return NextResponse.redirect(new URL("/?denied=admin", req.nextUrl));
  }

  // The technician panel is personal; admins get the full team view instead.
  if ((pathname === "/tech" || pathname.startsWith("/tech/")) && session.role !== "tech") {
    return NextResponse.redirect(new URL("/admin/team", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
