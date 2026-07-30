import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb, activityLog } from "@/db";

export async function GET(req: NextRequest) {
  const db = await getDb();
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(p.get("page") || "1"));
  const pageSize = 40;
  const entity = p.get("entity") || "";
  const q = (p.get("q") || "").trim();

  const conds: SQL[] = [];
  if (entity) conds.push(eq(activityLog.entity, entity));
  if (q) {
    const like = `%${q}%`;
    conds.push(or(ilike(activityLog.summary, like), ilike(activityLog.action, like))!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select()
    .from(activityLog)
    .where(where)
    .orderBy(desc(activityLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [total] = await db.select({ n: count() }).from(activityLog).where(where);

  return NextResponse.json({ rows, total: total.n, page, pageSize });
}
