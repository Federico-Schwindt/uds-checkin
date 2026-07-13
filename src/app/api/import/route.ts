import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { eq, inArray } from "drizzle-orm";
import { getDb, customers, entries, parts, statusHistory } from "@/db";
import { normalizePhone } from "@/lib/utils";

export const maxDuration = 300;

/**
 * Imports the Gravity Forms "ODESSA CHECK-IN" entries CSV export.
 * Duplicate headers are disambiguated by occurrence index:
 *   "Type of Driveshaft" #1 = pieces, #2 = designer type
 *   "Signature" #1 = estimate, #2 = final
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a CSV file in the 'file' field" }, { status: 400 });
  }

  const text = (await file.text()).replace(/^﻿/, "");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
  if (parsed.errors.length > 3) {
    return NextResponse.json({ error: `CSV parse errors: ${parsed.errors[0].message}` }, { status: 400 });
  }
  const [header, ...rows] = parsed.data;
  if (!header || rows.length === 0) {
    return NextResponse.json({ error: "CSV appears to be empty" }, { status: 400 });
  }

  // Column resolver handling duplicate header names by occurrence.
  const positions = new Map<string, number[]>();
  header.forEach((h, i) => {
    const key = h.trim();
    if (!positions.has(key)) positions.set(key, []);
    positions.get(key)!.push(i);
  });
  const col = (name: string, occurrence = 0): number => {
    const arr = positions.get(name);
    return arr && arr.length > occurrence ? arr[occurrence] : -1;
  };
  const consentCol = header.findIndex((h) => h.startsWith("By checking this box"));

  const C = {
    firstName: col("Full Name (First)"),
    lastName: col("Full Name (Last)"),
    street: col("Address (Street Address)"),
    address2: col("Address (Address Line 2)"),
    city: col("Address (City)"),
    state: col("Address (State / Province)"),
    zip: col("Address (ZIP / Postal Code)"),
    country: col("Address (Country)"),
    phone: col("Phone"),
    email: col("Email"),
    consent: consentCol,
    estimateChoice: col("Select one option"),
    estimateAmount: col("Amount:"),
    estimateSignature: col("Signature", 0),
    estimateDate: col("Date"),
    year: col("Year"),
    make: col("Make"),
    model: col("Model"),
    drive: col("Drive"),
    axleLocation: col("Location"),
    cab: col("Cab"),
    transmission: col("Transmission"),
    transmissionSpeed: col("Transmission Speed"),
    engineSize: col("Engine Size"),
    bedSize: col("Bed Size"),
    bedSizeOther: col("Other Bed Size"),
    wheelbase: col("WheelBase"),
    horsePower: col("Horse Power"),
    stockVehicle: col("Stock vehicle"),
    stockVehicleExplain: col("If No Stock Vehicle, Please Explain"),
    vinMethod: col("VIN NUMBER"),
    vinPhoto: col("VIN PHOTO"),
    vin: col("VIN"),
    mileage: col("Mileage"),
    saveOldParts: col("Save old parts : (Core May Apply )"),
    complaint: col("Customer complaint / problem:"),
    complaintOther: col("Specify your problem / complaint:"),
    notes: col("Notes/Reason of coming"),
    laborRequest: col("Labor Request"),
    laborOther: col("Other Labor (Specify)"),
    driveshaftPieces: col("Type of Driveshaft", 0),
    designerType: col("Type of Driveshaft", 1),
    driveshaftMaterial: col("Driveshaft Material"),
    uJointSerial: col("U-JOINT SER"),
    driveshaftTypeChoice: col("Choose your Driveshaft Type"),
    productImage: col("Product Image"),
    measurementA: col("A measurement"),
    measurementB: col("B measurement"),
    measurementC: col("C measurement"),
    partSku: col("PARTS USED ON THIS ORDER. / Part SKU Scanner"),
    partQty: col("PARTS USED ON THIS ORDER. / Quantity"),
    howHeard: col("How did You Hear About Us"),
    deposit: col("Payment Deposit"),
    total: col("Total"),
    finalSignature: col("Signature", 1),
    jobNumber: col("Job Number"),
    employeeName: col("Employee Name"),
    core: col("Core"),
    jobStatus: col("Job Status"),
    onHoldReason: col("On Hold Reason"),
    payment: col("Payment"),
    confirmationDate: col("Confirmation Date"),
    assignedEmployee: col("Assigned Employee"),
    timeOfJob: col("Time of Job"),
    signingDate: col("Signing Date"),
    etaJob: col("ETA Job"),
    entryId: col("Entry Id"),
    entryDate: col("Entry Date"),
  };

  if (C.firstName < 0 || C.phone < 0 || C.entryId < 0) {
    return NextResponse.json(
      { error: "This CSV doesn't look like the Gravity Forms ODESSA CHECK-IN export (missing expected columns)" },
      { status: 400 }
    );
  }

  const db = await getDb();

  // Skip rows already imported.
  const sourceIds = rows
    .map((r) => parseInt(r[C.entryId] || ""))
    .filter((n) => !isNaN(n));
  const already = sourceIds.length
    ? await db.select({ id: entries.sourceEntryId }).from(entries).where(inArray(entries.sourceEntryId, sourceIds))
    : [];
  const alreadySet = new Set(already.map((r) => r.id));

  const get = (row: string[], idx: number) => (idx >= 0 ? (row[idx] || "").trim() : "");
  const toNumeric = (v: string) => {
    const n = parseFloat((v || "").replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n.toFixed(2);
  };

  let imported = 0;
  let skipped = 0;
  let customersCreated = 0;
  let customersMatched = 0;
  const errors: string[] = [];

  // Cache phone → customerId to avoid repeated lookups.
  const phoneCache = new Map<string, number>();

  for (const row of rows) {
    const sourceId = parseInt(get(row, C.entryId));
    if (isNaN(sourceId) || alreadySet.has(sourceId)) {
      skipped++;
      continue;
    }

    try {
      const phone = normalizePhone(get(row, C.phone));
      const firstName = get(row, C.firstName);
      const lastName = get(row, C.lastName);
      const smsConsent = get(row, C.consent).length > 0;

      let customerId: number | null = null;
      if (phone && phoneCache.has(phone)) {
        customerId = phoneCache.get(phone)!;
        customersMatched++;
      } else if (phone) {
        const found = await db.select({ id: customers.id }).from(customers).where(eq(customers.phone, phone));
        if (found.length) {
          customerId = found[0].id;
          customersMatched++;
        }
      }
      if (!customerId) {
        const [c] = await db
          .insert(customers)
          .values({
            firstName,
            lastName,
            phone,
            email: get(row, C.email),
            street: get(row, C.street),
            address2: get(row, C.address2),
            city: get(row, C.city),
            state: get(row, C.state),
            zip: get(row, C.zip),
            country: get(row, C.country) || "United States",
            smsConsent,
          })
          .returning({ id: customers.id });
        customerId = c.id;
        customersCreated++;
      }
      if (phone) phoneCache.set(phone, customerId);

      const createdAtRaw = get(row, C.entryDate);
      const createdAt = createdAtRaw ? new Date(createdAtRaw) : new Date();
      const jobStatus = get(row, C.jobStatus) || "New";

      const [e] = await db
        .insert(entries)
        .values({
          customerId,
          sourceEntryId: sourceId,
          createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
          estimateChoice: get(row, C.estimateChoice),
          estimateAmount: get(row, C.estimateAmount),
          estimateSignature: get(row, C.estimateSignature),
          estimateDate: get(row, C.estimateDate),
          vehicleYear: get(row, C.year),
          vehicleMake: get(row, C.make),
          vehicleModel: get(row, C.model),
          drive: get(row, C.drive),
          axleLocation: get(row, C.axleLocation),
          cab: get(row, C.cab),
          transmission: get(row, C.transmission),
          transmissionSpeed: get(row, C.transmissionSpeed),
          engineSize: get(row, C.engineSize),
          bedSize: get(row, C.bedSize),
          bedSizeOther: get(row, C.bedSizeOther),
          wheelbase: get(row, C.wheelbase),
          horsePower: get(row, C.horsePower),
          stockVehicle: get(row, C.stockVehicle),
          stockVehicleExplain: get(row, C.stockVehicleExplain),
          vinMethod: get(row, C.vinMethod),
          vinPhoto: get(row, C.vinPhoto),
          vin: get(row, C.vin),
          mileage: get(row, C.mileage),
          saveOldParts: get(row, C.saveOldParts),
          complaint: get(row, C.complaint),
          complaintOther: get(row, C.complaintOther),
          notes: get(row, C.notes),
          laborRequest: get(row, C.laborRequest),
          laborOther: get(row, C.laborOther),
          driveshaftPieces: get(row, C.driveshaftPieces),
          driveshaftMaterial: get(row, C.driveshaftMaterial),
          uJointSerial: get(row, C.uJointSerial),
          driveshaftTypeChoice: get(row, C.driveshaftTypeChoice),
          productImage: get(row, C.productImage),
          measurementA: get(row, C.measurementA),
          measurementB: get(row, C.measurementB),
          measurementC: get(row, C.measurementC),
          designerType: get(row, C.designerType),
          howHeard: get(row, C.howHeard),
          deposit: toNumeric(get(row, C.deposit)),
          total: toNumeric(get(row, C.total)),
          finalSignature: get(row, C.finalSignature),
          jobNumber: get(row, C.jobNumber),
          employeeName: get(row, C.employeeName),
          core: get(row, C.core),
          jobStatus,
          onHoldReason: get(row, C.onHoldReason),
          payment: get(row, C.payment),
          confirmationDate: get(row, C.confirmationDate),
          assignedEmployee: get(row, C.assignedEmployee),
          timeOfJob: get(row, C.timeOfJob),
          signingDate: get(row, C.signingDate),
          etaJob: get(row, C.etaJob),
        })
        .returning({ id: entries.id });

      // Parts: GF nested-form exports join child values with commas.
      const skus = get(row, C.partSku)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const qtys = get(row, C.partQty)
        .split(",")
        .map((s) => parseInt(s.trim()) || 1);
      if (skus.length) {
        await db.insert(parts).values(
          skus.map((sku, i) => ({ entryId: e.id, sku, name: "", qty: qtys[i] || 1, price: null }))
        );
      }

      await db.insert(statusHistory).values({
        entryId: e.id,
        fromStatus: "",
        toStatus: jobStatus,
        note: "Imported from Gravity Forms",
        createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
      });

      imported++;
    } catch (err) {
      errors.push(`Entry ${sourceId}: ${err instanceof Error ? err.message : String(err)}`);
      if (errors.length > 20) break;
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    customersCreated,
    customersMatched,
    errors: errors.slice(0, 10),
    totalRows: rows.length,
  });
}
