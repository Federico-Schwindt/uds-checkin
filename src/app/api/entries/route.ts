import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, entries, customers, parts, statusHistory, locations } from "@/db";
import { normalizePhone } from "@/lib/utils";
import { storeDataUrl } from "@/lib/storage";
import { notifyForEntry, notifyStatusChange } from "@/lib/notify";
import { logActivity } from "@/lib/audit";
import type { CheckinData } from "@/components/checkin/types";

async function maybeStore(value: string, name: string): Promise<string> {
  if (value?.startsWith("data:")) return storeDataUrl(value, name);
  return value || "";
}

/** Custom fields may carry photos/signatures/files as data URLs; persist them to storage. */
async function storeCustomAssets(custom: Record<string, unknown> | undefined | null) {
  if (!custom) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(custom)) {
    if (typeof value === "string" && value.startsWith("data:")) {
      out[key] = await storeDataUrl(value, key);
    } else if (Array.isArray(value)) {
      out[key] = await Promise.all(
        value.map(async (v, i) =>
          typeof v === "string" && v.startsWith("data:") ? await storeDataUrl(v, `${key}-${i}`) : v
        )
      );
    } else {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : null;
}

export async function POST(req: NextRequest) {
  const data = (await req.json().catch(() => null)) as CheckinData | null;
  if (!data) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const phone = normalizePhone(data.phone);
  if (!data.firstName?.trim() || !data.lastName?.trim() || phone.length !== 10) {
    return NextResponse.json({ error: "First name, last name and a valid phone are required" }, { status: 400 });
  }

  const db = await getDb();
  const toNumeric = (v: string) => {
    const n = parseFloat((v || "").replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n.toFixed(2);
  };

  // Store binary assets BEFORE the transaction (external I/O, may be slow).
  let estimateSignature = "", finalSignature = "", vinPhoto = "", productImage = "";
  let customAssets: Record<string, unknown> | null = null;
  try {
    [estimateSignature, finalSignature, vinPhoto, productImage] = await Promise.all([
      maybeStore(data.estimateSignature, "estimate-signature"),
      maybeStore(data.finalSignature, "final-signature"),
      maybeStore(data.vinPhoto, "vin-photo"),
      maybeStore(data.productImage, "product-image"),
    ]);
    customAssets = await storeCustomAssets(data.custom);
  } catch (err) {
    console.error("asset storage failed", err);
    await logActivity({
      action: "entry.create.error",
      entity: "entry",
      summary: `Check-in failed while saving photos/signatures for ${data.firstName} ${data.lastName}`,
      details: { error: String(err) },
      req,
    });
    return NextResponse.json({ error: "Could not save the attached photos/signatures. Please try again." }, { status: 500 });
  }

  const customerValues = {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    phone,
    email: (data.email || "").trim(),
    street: data.street || "",
    city: data.city || "",
    state: data.state || "",
    zip: data.zip || "",
    smsConsent: !!data.smsConsent,
    updatedAt: new Date(),
  };
  const requestedLocation = Number(data.locationId) || null;
  const partLines = (data.parts || []).filter((p) => p.sku?.trim() || p.name?.trim());

  // Atomic write: customer + entry + parts + first status row all-or-nothing,
  // so a check-in can never be half-created or silently missing.
  let entryId: number;
  try {
    entryId = await db.transaction(async (tx) => {
      const [defaultLocation] = await tx.select().from(locations).orderBy(locations.id).limit(1);

      let customerId = data.customerId ?? null;
      if (customerId) {
        const found = await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customerId));
        if (found.length) await tx.update(customers).set(customerValues).where(eq(customers.id, customerId));
        else customerId = null;
      }
      if (!customerId) {
        const byPhone = await tx.select({ id: customers.id }).from(customers).where(eq(customers.phone, phone));
        if (byPhone.length) {
          customerId = byPhone[0].id;
          await tx.update(customers).set(customerValues).where(eq(customers.id, customerId));
        } else {
          const ins = await tx.insert(customers).values(customerValues).returning({ id: customers.id });
          customerId = ins[0].id;
        }
      }

      const inserted = await tx
        .insert(entries)
        .values(buildEntryValues(data, {
          customerId,
          locationId: requestedLocation ?? defaultLocation?.id ?? null,
          estimateSignature,
          finalSignature,
          vinPhoto,
          productImage,
          custom: customAssets,
          toNumeric,
        }))
        .returning({ id: entries.id });
      const id = inserted[0].id;

      if (partLines.length) {
        await tx.insert(parts).values(
          partLines.map((p) => ({
            entryId: id,
            sku: p.sku || "",
            name: p.name || "",
            qty: Math.max(1, Number(p.qty) || 1),
            price: toNumeric(p.price),
          }))
        );
      }
      await tx.insert(statusHistory).values({ entryId: id, fromStatus: "", toStatus: data.jobStatus || "New" });
      return id;
    });
  } catch (err) {
    console.error("entry create transaction failed", err);
    await logActivity({
      action: "entry.create.error",
      entity: "entry",
      summary: `Check-in failed for ${data.firstName} ${data.lastName}`,
      details: { error: String(err) },
      req,
    });
    return NextResponse.json({ error: "Could not save the check-in. Nothing was stored — please try again." }, { status: 500 });
  }

  // Verify the row is actually readable back before telling the client it worked.
  const check = await db.select({ id: entries.id }).from(entries).where(eq(entries.id, entryId));
  if (!check.length) {
    await logActivity({
      action: "entry.create.error",
      entity: "entry",
      entityId: entryId,
      summary: "Entry insert reported success but the row could not be read back",
      req,
    });
    return NextResponse.json({ error: "Save could not be confirmed. Please check the entries list before retrying." }, { status: 500 });
  }

  await logActivity({
    action: "entry.create",
    entity: "entry",
    entityId: entryId,
    summary: `New check-in #${entryId} — ${data.firstName} ${data.lastName}${data.jobNumber ? ` (Job ${data.jobNumber})` : ""}`,
    details: { vehicle: [data.vehicleYear, data.vehicleMake, data.vehicleModel].filter(Boolean).join(" "), jobStatus: data.jobStatus || "New" },
    req,
  });

  // Fire notifications; never fail the check-in because of them.
  try {
    await notifyForEntry(entryId, "submission");
    await notifyForEntry(entryId, "admin_submission");
    if (data.jobStatus && data.jobStatus !== "New") {
      await notifyStatusChange(entryId, data.jobStatus);
    }
  } catch (err) {
    console.error("notify failed", err);
  }

  return NextResponse.json({ id: entryId });
}

/** Maps check-in data to the entries row (shared shape, kept out of the transaction body). */
function buildEntryValues(
  data: CheckinData,
  extra: {
    customerId: number | null;
    locationId: number | null;
    estimateSignature: string;
    finalSignature: string;
    vinPhoto: string;
    productImage: string;
    custom: Record<string, unknown> | null;
    toNumeric: (v: string) => string | null;
  }
) {
  const { toNumeric } = extra;
  return {
    locationId: extra.locationId,
    customerId: extra.customerId,
    estimateChoice: data.estimateChoice || "",
    estimateAmount: data.estimateAmount || "",
    estimateSignature: extra.estimateSignature,
    estimateDate: data.estimateDate || "",
    vehicleYear: data.vehicleYear || "",
    vehicleMake: data.vehicleMake || "",
    vehicleModel: data.vehicleModel || "",
    drive: data.drive || "",
    axleLocation: data.axleLocation || "",
    cab: data.cab || "",
    transmission: data.transmission || "",
    transmissionSpeed: data.transmissionSpeed || "",
    engineSize: data.engineSize || "",
    bedSize: data.bedSize || "",
    bedSizeOther: data.bedSizeOther || "",
    wheelbase: data.wheelbase || "",
    horsePower: data.horsePower || "",
    stockVehicle: data.stockVehicle || "",
    stockVehicleExplain: data.stockVehicleExplain || "",
    vinMethod: data.vinMethod || "",
    vinPhoto: extra.vinPhoto,
    vin: data.vin || "",
    mileage: data.mileage || "",
    saveOldParts: data.saveOldParts || "",
    complaint: data.complaint || "",
    complaintOther: data.complaintOther || "",
    notes: data.notes || "",
    laborRequest: data.laborRequest || "",
    laborOther: data.laborOther || "",
    driveshaftPieces: data.driveshaftPieces || "",
    driveshaftMaterial: data.driveshaftMaterial || "",
    uJointSerial: data.uJointSerial || "",
    driveshaftTypeChoice: data.driveshaftTypeChoice || "",
    productImage: extra.productImage,
    measurementA: data.measurementA || "",
    measurementB: data.measurementB || "",
    measurementC: data.measurementC || "",
    designerType: data.designerType || "",
    howHeard: data.howHeard || "",
    custom: extra.custom,
    deposit: toNumeric(data.deposit),
    total: toNumeric(data.total),
    finalSignature: extra.finalSignature,
    jobNumber: data.jobNumber || "",
    employeeName: data.employeeName || "",
    core: data.core || "",
    jobStatus: data.jobStatus || "New",
    onHoldReason: data.jobStatus === "On hold" ? data.onHoldReason || "" : "",
    payment: data.payment || "",
    confirmationDate: data.confirmationDate || "",
    assignedEmployee: data.jobStatus === "Ongoing" ? data.assignedEmployee || "" : "",
    timeOfJob: data.timeOfJob || "",
    signingDate: data.signingDate || "",
    etaJob: data.etaJob || "",
  };
}

export async function GET(req: NextRequest) {
  const db = await getDb();
  const p = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(p.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(10, parseInt(p.get("pageSize") || "25")));
  const status = p.get("status") || "";
  const payment = p.get("payment") || "";
  const q = (p.get("q") || "").trim();
  const from = p.get("from") || "";
  const to = p.get("to") || "";
  const locationId = parseInt(p.get("locationId") || "");

  const conds: SQL[] = [];
  // every filter except status — used for the per-status counters. Always hides soft-deleted rows.
  const baseConds: SQL[] = [isNull(entries.deletedAt)];
  if (!isNaN(locationId)) baseConds.push(eq(entries.locationId, locationId));
  if (status) conds.push(eq(entries.jobStatus, status));
  if (payment) baseConds.push(eq(entries.payment, payment));
  if (from) baseConds.push(gte(entries.createdAt, new Date(from)));
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    baseConds.push(lte(entries.createdAt, d));
  }
  if (q) {
    const digits = normalizePhone(q);
    const like = `%${q}%`;
    const parts_ = [
      ilike(customers.firstName, like),
      ilike(customers.lastName, like),
      ilike(entries.jobNumber, like),
      ilike(entries.vehicleModel, like),
      ilike(entries.vehicleMake, like),
      ilike(sql`(${customers.firstName} || ' ' || ${customers.lastName})`, like),
    ];
    if (digits.length >= 3) parts_.push(ilike(customers.phone, `%${digits}%`));
    baseConds.push(or(...parts_)!);
  }

  const allConds = [...baseConds, ...conds];
  const where = allConds.length ? and(...allConds) : undefined;
  const baseWhere = baseConds.length ? and(...baseConds) : undefined;

  const rows = await db
    .select({
      id: entries.id,
      jobNumber: entries.jobNumber,
      jobStatus: entries.jobStatus,
      payment: entries.payment,
      vehicleYear: entries.vehicleYear,
      vehicleMake: entries.vehicleMake,
      vehicleModel: entries.vehicleModel,
      laborRequest: entries.laborRequest,
      total: entries.total,
      deposit: entries.deposit,
      createdAt: entries.createdAt,
      etaJob: entries.etaJob,
      locationId: entries.locationId,
      onHoldReason: entries.onHoldReason,
      assignedEmployee: entries.assignedEmployee,
      customerId: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      phone: customers.phone,
    })
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(where)
    .orderBy(desc(entries.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [total] = await db
    .select({ n: count() })
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(where);

  // Per-status counters for the kiosk filter chips (same filters, status excluded).
  const byStatus = await db
    .select({ status: entries.jobStatus, n: count() })
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(baseWhere)
    .groupBy(entries.jobStatus);
  const statusCounts: Record<string, number> = {};
  let all = 0;
  for (const r of byStatus) {
    statusCounts[r.status] = r.n;
    all += r.n;
  }
  statusCounts.All = all;

  return NextResponse.json({ rows, total: total.n, page, pageSize, statusCounts });
}
