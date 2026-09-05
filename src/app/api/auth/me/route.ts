import { NextRequest, NextResponse } from "next/server";
import { sessionFromRequest } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: { id: session.uid, name: session.name, username: session.username, role: session.role },
  });
}
