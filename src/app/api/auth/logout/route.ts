import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { sessionFromRequest } from "@/lib/session";
import { logActivity } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (session) {
    await logActivity({
      action: "auth.logout",
      entity: "user",
      entityId: session.uid,
      actor: session.name,
      summary: `${session.name} signed out`,
      req,
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
