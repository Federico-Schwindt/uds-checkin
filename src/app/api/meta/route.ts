import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, employees, locations } from "@/db";

export async function GET() {
  const db = await getDb();
  const emps = await db.select().from(employees).where(eq(employees.active, true)).orderBy(asc(employees.sortOrder));
  const locs = await db.select().from(locations).where(eq(locations.active, true)).orderBy(asc(locations.id));
  return NextResponse.json({
    employees: emps.map((e) => e.name),
    locations: locs.map((l) => ({ id: l.id, name: l.name })),
  });
}
