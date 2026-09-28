import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, ilike, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb, entries, customers } from "@/db";
import { formatPhone, normalizePhone } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { allFields, holdsValue } from "@/lib/form-schema";
import { resolveSchema } from "@/lib/form-schema-default";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const db = await getDb();
  const p = req.nextUrl.searchParams;
  const status = p.get("status") || "";
  const payment = p.get("payment") || "";
  const q = (p.get("q") || "").trim();
  const from = p.get("from") || "";
  const to = p.get("to") || "";

  const conds: SQL[] = [isNull(entries.deletedAt)];
  if (status) conds.push(eq(entries.jobStatus, status));
  if (payment) conds.push(eq(entries.payment, payment));
  if (from) conds.push(gte(entries.createdAt, new Date(from)));
  if (to) {
    const d = new Date(to);
    d.setHours(23, 59, 59, 999);
    conds.push(lte(entries.createdAt, d));
  }
  if (q) {
    const digits = normalizePhone(q);
    const like = `%${q}%`;
    const parts_ = [
      ilike(customers.firstName, like),
      ilike(customers.lastName, like),
      ilike(entries.jobNumber, like),
      ilike(sql`(${customers.firstName} || ' ' || ${customers.lastName})`, like),
    ];
    if (digits.length >= 3) {
      parts_.push(ilike(customers.phone, `%${digits}%`), ilike(customers.companyPhone, `%${digits}%`));
    }
    conds.push(or(...parts_)!);
  }
  const where = conds.length ? and(...conds) : undefined;

  const rows = await db
    .select()
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(where)
    .orderBy(desc(entries.createdAt))
    .limit(10000);

  // Admin-defined custom fields become extra columns, in schema order.
  const settings = await getSettings();
  const schema = resolveSchema(settings.formSchema);
  const customCols = allFields(schema)
    .filter((f) => !f.core && holdsValue(f.type) && f.key)
    .map((f) => ({ key: f.key, label: f.label || f.key }));

  const header = [
    "Entry ID", "Created", "Job Number", "Status", "Payment",
    "First Name", "Last Name", "Cell Phone (Texts)", "Company Phone", "Email", "Street", "City", "State", "ZIP", "SMS Consent",
    "Year", "Make", "Model", "Drive", "Location", "Cab", "Transmission", "Trans Speed",
    "Engine", "Bed Size", "Wheelbase", "HP", "VIN", "Mileage", "Stock", "Save Old Parts",
    "Complaint", "Notes", "Labor Request", "Driveshaft Pieces", "Material", "U-Joint Serial",
    "Driveshaft Type", "A", "B", "C", "Designer Type", "How Heard",
    "Deposit", "Total", "Employee", "Core", "On Hold Reason", "Assigned Employee", "ETA",
    ...customCols.map((c) => c.label),
  ];

  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const e = r.entries;
    const c = r.customers;
    lines.push(
      [
        e.id, e.createdAt?.toISOString() ?? "", e.jobNumber, e.jobStatus, e.payment,
        c?.firstName ?? "", c?.lastName ?? "", formatPhone(c?.phone ?? ""), formatPhone(c?.companyPhone ?? ""),
        c?.email ?? "",
        c?.street ?? "", c?.city ?? "", c?.state ?? "", c?.zip ?? "", c?.smsConsent ? "Yes" : "No",
        e.vehicleYear, e.vehicleMake, e.vehicleModel, e.drive, e.axleLocation, e.cab,
        e.transmission, e.transmissionSpeed, e.engineSize,
        e.bedSize === "Other" ? e.bedSizeOther : e.bedSize,
        e.wheelbase, e.horsePower, e.vin, e.mileage, e.stockVehicle, e.saveOldParts,
        e.complaint === "Something else" ? e.complaintOther : e.complaint,
        e.notes, e.laborRequest === "Other" ? e.laborOther : e.laborRequest,
        e.driveshaftPieces, e.driveshaftMaterial, e.uJointSerial, e.driveshaftTypeChoice,
        e.measurementA, e.measurementB, e.measurementC, e.designerType, e.howHeard,
        e.deposit ?? "", e.total ?? "", e.employeeName, e.core, e.onHoldReason, e.assignedEmployee, e.etaJob,
        ...customCols.map((c) => {
          const v = (e.custom as Record<string, unknown> | null)?.[c.key];
          if (v == null) return "";
          if (Array.isArray(v)) return v.join(" | ");
          if (typeof v === "boolean") return v ? "Yes" : "No";
          return String(v);
        }),
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="uds-entries-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
