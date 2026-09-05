import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { customers, entries, getDb } from "@/db";
import { sessionFromRequest } from "@/lib/session";

/** Work orders the admin can attach to a technician's calendar. */
export async function GET(req: NextRequest) {
  if (sessionFromRequest(req)?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const conds: SQL[] = [isNull(entries.deletedAt)];
  if (q) {
    const like = `%${q}%`;
    conds.push(
      or(
        ilike(entries.jobNumber, like),
        ilike(customers.firstName, like),
        ilike(customers.lastName, like),
        ilike(entries.vehicleMake, like),
        ilike(entries.vehicleModel, like)
      )!
    );
  }

  const db = await getDb();
  const rows = await db
    .select({
      id: entries.id,
      jobNumber: entries.jobNumber,
      jobStatus: entries.jobStatus,
      vehicleYear: entries.vehicleYear,
      vehicleMake: entries.vehicleMake,
      vehicleModel: entries.vehicleModel,
      firstName: customers.firstName,
      lastName: customers.lastName,
      assignedEmployee: entries.assignedEmployee,
      createdAt: entries.createdAt,
    })
    .from(entries)
    .leftJoin(customers, eq(entries.customerId, customers.id))
    .where(and(...conds))
    .orderBy(desc(entries.createdAt))
    .limit(100);
  return NextResponse.json({ workOrders: rows });
}
