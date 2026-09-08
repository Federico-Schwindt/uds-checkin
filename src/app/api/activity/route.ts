import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, activityLog } from "@/db";

export async function GET(req: NextRequest) {
  const db = await getDb();
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(p.get("page") || "1"));
  const pageSize = Math.min(200, Math.max(10, parseInt(p.get("pageSize") || "40")));
  const entity = p.get("entity") || "";
  const entityId = parseInt(p.get("entityId") || "", 10);
  const actor = p.get("actor") || "";
  const from = p.get("from") || "";
  const to = p.get("to") || "";
  const q = (p.get("q") || "").trim();

  const conds: SQL[] = [];
  if (entity) conds.push(eq(activityLog.entity, entity));
  if (!isNaN(entityId)) conds.push(eq(activityLog.entityId, entityId));
  // Actors are stored as "Name (role)", so match on the name.
  if (actor) conds.push(ilike(activityLog.actor, `${actor}%`));
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) conds.push(gte(activityLog.createdAt, new Date(`${from}T00:00:00`)));
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) conds.push(lte(activityLog.createdAt, new Date(`${to}T23:59:59`)));
  if (q) {
    const like = `%${q}%`;
    conds.push(or(ilike(activityLog.summary, like), ilike(activityLog.action, like), ilike(activityLog.actor, like))!);
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

  // Everyone who has ever done something, for the "who" filter.
  const people = await db
    .selectDistinct({ actor: activityLog.actor })
    .from(activityLog)
    .where(sql`${activityLog.actor} <> ''`)
    .orderBy(activityLog.actor);

  return NextResponse.json({
    rows,
    total: total.n,
    page,
    pageSize,
    people: [...new Set(people.map((r) => r.actor.replace(/\s*\((admin|tech)\)$/, "")))].filter(Boolean),
  });
}
