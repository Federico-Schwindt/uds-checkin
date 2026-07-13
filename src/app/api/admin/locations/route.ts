import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, locations } from "@/db";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(locations).orderBy(asc(locations.id));
  return NextResponse.json({ locations: rows });
}

export async function POST(req: NextRequest) {
  const { name, twilioFrom } = await req.json().catch(() => ({}));
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const db = await getDb();
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const [row] = await db
    .insert(locations)
    .values({ name: name.trim(), slug, twilioFrom: twilioFrom || null })
    .returning();
  return NextResponse.json({ location: row });
}

export async function PUT(req: NextRequest) {
  const { id, name, twilioFrom, active } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });
  const db = await getDb();
  const patch: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) patch.name = name.trim();
  if (typeof twilioFrom === "string") patch.twilioFrom = twilioFrom || null;
  if (typeof active === "boolean") patch.active = active;
  await db.update(locations).set(patch).where(eq(locations.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });
  const db = await getDb();
  await db.delete(locations).where(eq(locations.id, id));
  return NextResponse.json({ ok: true });
}
