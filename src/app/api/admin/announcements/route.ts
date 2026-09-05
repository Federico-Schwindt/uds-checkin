import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { announcements, getDb } from "@/db";
import { sessionFromRequest } from "@/lib/session";
import { actorLabel } from "@/lib/auth";
import { logActivity } from "@/lib/audit";

const KINDS = ["info", "warning", "closure"];

function requireAdmin(req: NextRequest) {
  const session = sessionFromRequest(req);
  return session?.role === "admin" ? session : null;
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const db = await getDb();
  const rows = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(50);
  return NextResponse.json({ announcements: rows });
}

export async function POST(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "Give the notice a title" }, { status: 400 });

  const expires = String(body.expiresAt || "").trim();
  const db = await getDb();
  const [row] = await db
    .insert(announcements)
    .values({
      title,
      body: String(body.body || "").trim(),
      kind: KINDS.includes(body.kind) ? body.kind : "info",
      // Stored as end-of-day so "expires today" means the whole day.
      expiresAt: /^\d{4}-\d{2}-\d{2}$/.test(expires) ? new Date(`${expires}T23:59:59`) : null,
      pinned: !!body.pinned,
      createdBy: session.name,
    })
    .returning();

  await logActivity({
    action: "announcement.create",
    entity: "announcement",
    entityId: row.id,
    summary: `Posted a notice to the team: ${title}`,
    actor: actorLabel(session),
    req,
  });
  return NextResponse.json({ announcement: row });
}

export async function DELETE(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });
  const db = await getDb();
  await db.delete(announcements).where(eq(announcements.id, id));
  await logActivity({
    action: "announcement.delete",
    entity: "announcement",
    entityId: id,
    summary: `Removed notice #${id}`,
    actor: actorLabel(session),
    req,
  });
  return NextResponse.json({ ok: true });
}
