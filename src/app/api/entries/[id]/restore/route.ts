import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, entries } from "@/db";
import { logActivity } from "@/lib/audit";
import { sessionFromRequest } from "@/lib/session";
import { actorLabel } from "@/lib/auth";

/** Undo a soft-delete: clears deletedAt so the entry reappears in the list. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr);
  const db = await getDb();

  const rows = await db.select({ id: entries.id, deletedAt: entries.deletedAt }).from(entries).where(eq(entries.id, id));
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.update(entries).set({ deletedAt: null }).where(eq(entries.id, id));
  await logActivity({
    action: "entry.restore",
    entity: "entry",
    entityId: id,
    summary: `Restored entry #${id}`,
    actor: actorLabel(sessionFromRequest(req)),
    req,
  });
  return NextResponse.json({ ok: true });
}
