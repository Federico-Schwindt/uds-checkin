import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, entries, customers, parts, statusHistory, messageLog } from "@/db";
import { notifyStatusChange } from "@/lib/notify";
import { jobLabel, normalizePhone } from "@/lib/utils";
import { diffFields, logActivity } from "@/lib/audit";
import { sessionFromRequest } from "@/lib/session";
import { actorLabel } from "@/lib/auth";
import { getEntryEvents } from "@/lib/performance";

/** `includeFlags` is admin-only — performance records are not shop-floor reading. */
async function loadEntry(id: number, includeFlags = false) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(eq(entries.id, id));
  if (!rows.length) return null;
  // The four related lists are independent — fetch them in one go.
  const [partRows, history, messages, flags] = await Promise.all([
    db.select().from(parts).where(eq(parts.entryId, id)).orderBy(asc(parts.id)),
    db.select().from(statusHistory).where(eq(statusHistory.entryId, id)).orderBy(asc(statusHistory.createdAt)),
    db.select().from(messageLog).where(eq(messageLog.entryId, id)).orderBy(asc(messageLog.createdAt)),
    includeFlags ? getEntryEvents(id) : Promise.resolve([]),
  ]);
  return { entry: rows[0].entries, customer: rows[0].customers, parts: partRows, history, messages, flags };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await loadEntry(parseInt(id), sessionFromRequest(req)?.role === "admin");
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
  "custom",
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
  const session = sessionFromRequest(req);
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
    // A status move gets its own record below, but anything else saved in the
    // same edit still has to land in the trail — quick edit saves whole rows.
    const audited = Object.keys(patch).filter((k) => !(statusChanged && k === "jobStatus"));
    const changed = diffFields(current as Record<string, unknown>, patch, audited);
    patch.updatedAt = new Date();
    await db.update(entries).set(patch).where(eq(entries.id, id));
    if (Object.keys(changed).length) {
      await logActivity({
        action: "entry.update",
        entity: "entry",
        entityId: id,
        summary: `Edited JOB${id} (${Object.keys(changed).join(", ")})`,
        details: changed,
        actor: actorLabel(session),
        req,
      });
    }
  }

  // Customer fields
  if (body.customer && current.customerId) {
    const cPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body.customer)) {
      if (CUSTOMER_EDITABLE.has(k)) cPatch[k] = v ?? "";
    }
    if (typeof cPatch.phone === "string") cPatch.phone = normalizePhone(cPatch.phone);
    if (Object.keys(cPatch).length) {
      const keys = Object.keys(cPatch);
      const before = await db.select().from(customers).where(eq(customers.id, current.customerId));
      cPatch.updatedAt = new Date();
      await db.update(customers).set(cPatch).where(eq(customers.id, current.customerId));
      // Logged against the entry, so a customer edit shows up on the job's own
      // timeline rather than somewhere nobody thinks to look.
      const changed = diffFields((before[0] || {}) as Record<string, unknown>, cPatch, keys);
      if (Object.keys(changed).length) {
        await logActivity({
          action: "customer.update",
          entity: "entry",
          entityId: id,
          summary: `Edited the customer on JOB${id} (${keys.join(", ")})`,
          details: changed,
          actor: actorLabel(session),
          req,
        });
      }
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
      changedBy: session?.name || "",
    });
    const skipNotify = body.skipNotify === true;
    if (!skipNotify) {
      try {
        notified = await notifyStatusChange(id, patch.jobStatus as string);
      } catch (err) {
        console.error("notify failed", err);
      }
    }
    await logActivity({
      action: "status.change",
      entity: "entry",
      entityId: id,
      summary: `JOB${id} status: ${current.jobStatus} → ${patch.jobStatus}`,
      details: { from: current.jobStatus, to: patch.jobStatus, notified: !skipNotify, by: session?.name || "" },
      actor: actorLabel(session),
      req,
    });
  }

  const data = await loadEntry(id, session?.role === "admin");
  return NextResponse.json({ ...data, notified, statusChanged });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr);
  const db = await getDb();
  const session = sessionFromRequest(req);

  const rows = await db
    .select()
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(eq(entries.id, id));
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { entries: entry, customers: customer } = rows[0];
  if (entry.deletedAt) return NextResponse.json({ ok: true, alreadyDeleted: true });

  // Soft-delete: hide it but keep the row and a full snapshot so it is recoverable.
  await db.update(entries).set({ deletedAt: new Date() }).where(eq(entries.id, id));

  const name = customer ? `${customer.firstName} ${customer.lastName}`.trim() : "";
  await logActivity({
    action: "entry.delete",
    entity: "entry",
    entityId: id,
    summary: `Deleted ${jobLabel(entry.jobNumber, id)}${name ? ` — ${name}` : ""}`,
    details: { entry, customer },
    actor: actorLabel(session),
    req,
  });

  return NextResponse.json({ ok: true });
}
