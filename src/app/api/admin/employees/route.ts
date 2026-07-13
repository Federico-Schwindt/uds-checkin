import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, employees } from "@/db";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(employees).orderBy(asc(employees.sortOrder), asc(employees.id));
  return NextResponse.json({ employees: rows });
}

export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const db = await getDb();
  const [row] = await db.insert(employees).values({ name: name.trim(), sortOrder: 99 }).returning();
  return NextResponse.json({ employee: row });
}

export async function PUT(req: NextRequest) {
  const { id, name, active } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });
  const db = await getDb();
  const patch: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) patch.name = name.trim();
  if (typeof active === "boolean") patch.active = active;
  await db.update(employees).set(patch).where(eq(employees.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });
  const db = await getDb();
  await db.delete(employees).where(eq(employees.id, id));
  return NextResponse.json({ ok: true });
}
