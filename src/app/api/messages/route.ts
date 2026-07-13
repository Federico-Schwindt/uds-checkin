import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { getDb, messageLog } from "@/db";

export async function GET(req: NextRequest) {
  const db = await getDb();
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(p.get("page") || "1"));
  const pageSize = 30;
  const channel = p.get("channel") || "";
  const status = p.get("status") || "";

  const conds: SQL[] = [];
  if (channel) conds.push(eq(messageLog.channel, channel));
  if (status) conds.push(eq(messageLog.status, status));
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select()
    .from(messageLog)
    .where(where)
    .orderBy(desc(messageLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [total] = await db.select({ n: count() }).from(messageLog).where(where);

  return NextResponse.json({ rows, total: total.n, page, pageSize });
}
