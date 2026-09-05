import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { announcementReads, assignments, getDb } from "@/db";
import { sessionFromRequest } from "@/lib/session";

/**
 * Marks what the signed-in technician has now seen: a notice they acknowledged,
 * or the assignments shown on their panel.
 */
export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const db = await getDb();

  const announcementId = Number(body.announcementId);
  if (announcementId) {
    try {
      await db.insert(announcementReads).values({ announcementId, userId: session.uid });
    } catch {
      // Already acknowledged — the unique index did its job.
    }
  }

  const assignmentIds = Array.isArray(body.assignmentIds)
    ? body.assignmentIds.map(Number).filter((n: number) => !isNaN(n))
    : [];
  if (assignmentIds.length) {
    await db
      .update(assignments)
      .set({ seenAt: new Date() })
      .where(and(eq(assignments.userId, session.uid), inArray(assignments.id, assignmentIds)));
  }

  return NextResponse.json({ ok: true });
}
