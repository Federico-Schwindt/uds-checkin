import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/session";
import { pollMailbox } from "@/lib/inbound-mail";

/**
 * Pulls email replies into their request threads. The admin panel calls this on
 * demand; a scheduled job calls it with CRON_SECRET instead of a session. It
 * lives outside /api/admin so a scheduler can reach it without a session cookie.
 */
export async function POST(req: NextRequest) {
  const isAdmin = sessionFromRequest(req)?.role === "admin";
  const secret = process.env.CRON_SECRET;
  const authorized =
    isAdmin || (!!secret && req.headers.get("authorization") === `Bearer ${secret}`);
  if (!authorized) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const result = await pollMailbox();
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}

export const GET = POST;
