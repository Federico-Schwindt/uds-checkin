import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, entries, parts, statusHistory } from "@/db";

/**
 * Clones an entry (same customer, vehicle, job info and parts) as a fresh job:
 * status New, no signatures, no job number, new timestamps.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr);
  const db = await getDb();

  const rows = await db.select().from(entries).where(eq(entries.id, id));
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const src = rows[0];

  const clone: Record<string, unknown> = { ...src };
  delete clone.id;
  clone.createdAt = new Date();
  clone.updatedAt = new Date();
  clone.sourceEntryId = null;
  clone.jobStatus = "New";
  clone.jobNumber = "";
  clone.estimateSignature = "";
  clone.finalSignature = "";
  clone.estimateDate = new Date().toISOString().slice(0, 10);
  clone.onHoldReason = "";
  clone.assignedEmployee = "";
  clone.confirmationDate = "";
  clone.timeOfJob = "";
  clone.signingDate = "";
  clone.payment = "";
  clone.etaJob = "";

  const [created] = await db
    .insert(entries)
    .values(clone as typeof entries.$inferInsert)
    .returning({ id: entries.id });

  const partRows = await db.select().from(parts).where(eq(parts.entryId, id));
  if (partRows.length) {
    await db.insert(parts).values(
      partRows.map((p) => ({ entryId: created.id, sku: p.sku, name: p.name, qty: p.qty, price: p.price }))
    );
  }

  await db.insert(statusHistory).values({
    entryId: created.id,
    fromStatus: "",
    toStatus: "New",
    note: `Duplicated from entry #${id}`,
  });

  return NextResponse.json({ id: created.id });
}
