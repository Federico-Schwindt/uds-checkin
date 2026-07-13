import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, messageTemplates } from "@/db";

export async function GET() {
  const db = await getDb();
  const rows = await db.select().from(messageTemplates).orderBy(asc(messageTemplates.id));
  return NextResponse.json({ templates: rows });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const db = await getDb();
  const patch: Record<string, unknown> = {};
  if (typeof body.subject === "string") patch.subject = body.subject;
  if (typeof body.body === "string") patch.body = body.body;
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  await db.update(messageTemplates).set(patch).where(eq(messageTemplates.id, body.id));
  const rows = await db.select().from(messageTemplates).where(eq(messageTemplates.id, body.id));
  return NextResponse.json({ template: rows[0] });
}
