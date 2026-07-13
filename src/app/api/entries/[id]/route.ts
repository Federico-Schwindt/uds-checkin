import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, entries, customers, parts, statusHistory, messageLog } from "@/db";
import { notifyStatusChange } from "@/lib/notify";
import { normalizePhone } from "@/lib/utils";

async function loadEntry(id: number) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(eq(entries.id, id));
  if (!rows.length) return null;
  const partRows = await db.select().from(parts).where(eq(parts.entryId, id)).orderBy(asc(parts.id));
  const history = await db
    .select()
    .from(statusHistory)
    .where(eq(statusHistory.entryId, id))
    .orderBy(asc(statusHistory.createdAt));
  const messages = await db
    .select()
    .from(messageLog)
    .where(eq(messageLog.entryId, id))
    .orderBy(asc(messageLog.createdAt));
  return { entry: rows[0].entries, customer: rows[0].customers, parts: partRows, history, messages };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await loadEntry(parseInt(id));
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

const ENTRY_EDITABLE = new Set([
  "estimateChoice", "estimateAmount", "estimateDate",
  "vehicleYear", "vehicleMake", "vehicleModel", "drive", "axleLocation", "cab",
  "transmission", "transmissionSpeed", "engineSize", "bedSize", "bedSizeOther",
  "wheelbase", "horsePower", "stockVehicle", "stockVehicleExplain", "vinMethod",
  "vin", "mileage", "saveOldParts", "complaint", "complaintOther", "notes",
  "laborRequest", "laborOther", "driveshaftPieces", "driveshaftMaterial",
  "uJointSerial", "driveshaftTypeChoice", "measurementA", "measurementB",
  "measurementC", "designerType", "howHeard", "deposit", "total", "jobNumber",
  "employeeName", "core", "jobStatus", "onHoldReason", "payment",
  "confirmationDate", "assignedEmployee", "timeOfJob", "signingDate", "etaJob",
]);

const CUSTOMER_EDITABLE = new Set([
  "firstName", "lastName", "phone", "email", "street", "city", "state", "zip", "smsConsent",
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr);
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const db = await getDb();
  const existing = await db.select().from(entries).where(eq(entries.id, id));
  if (!existing.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const current = existing[0];

  // Entry fields
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.entry || {})) {
    if (ENTRY_EDITABLE.has(k)) patch[k] = v ?? "";
  }
  if ("deposit" in patch) patch.deposit = patch.deposit === "" || patch.deposit == null ? null : patch.deposit;
  if ("total" in patch) patch.total = patch.total === "" || patch.total == null ? null : patch.total;

  const statusChanged =
    typeof patch.jobStatus === "string" && patch.jobStatus !== "" && patch.jobStatus !== current.jobStatus;

  if (Object.keys(patch).length) {
    patch.updatedAt = new Date();
    await db.update(entries).set(patch).where(eq(entries.id, id));
  }

  // Customer fields
  if (body.customer && current.customerId) {
    const cPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.customer)) {
      if (CUSTOMER_EDITABLE.has(k)) cPatch[k] = v ?? "";
    }
    if (typeof cPatch.phone === "string") cPatch.phone = normalizePhone(cPatch.phone);
    if (Object.keys(cPatch).length) {
      cPatch.updatedAt = new Date();
      await db.update(customers).set(cPatch).where(eq(customers.id, current.customerId));
    }
  }

  // Parts replacement
  if (Array.isArray(body.parts)) {
    await db.delete(parts).where(eq(parts.entryId, id));
    const lines = body.parts.filter((p: { sku?: string; name?: string }) => p.sku?.trim() || p.name?.trim());
    if (lines.length) {
      await db.insert(parts).values(
        lines.map((p: { sku?: string; name?: string; qty?: number; price?: string }) => ({
          entryId: id,
          sku: p.sku || "",
          name: p.name || "",
          qty: Math.max(1, Number(p.qty) || 1),
          price: p.price ? String(parseFloat(String(p.price)).toFixed(2)) : null,
        }))
      );
    }
  }

  let notified: { sms?: boolean; email?: boolean } = {};
  if (statusChanged) {
    await db.insert(statusHistory).values({
      entryId: id,
      fromStatus: current.jobStatus,
      toStatus: patch.jobStatus as string,
      note: body.note || "",
    });
    const skipNotify = body.skipNotify === true;
    if (!skipNotify) {
      try {
        notified = await notifyStatusChange(id, patch.jobStatus as string);
      } catch (err) {
        console.error("notify failed", err);
      }
    }
  }

  const data = await loadEntry(id);
  return NextResponse.json({ ...data, notified, statusChanged });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  await db.delete(entries).where(eq(entries.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
