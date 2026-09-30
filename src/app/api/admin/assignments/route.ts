import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import { assignments, customers, entries, getDb, users } from "@/db";
import { sessionFromRequest } from "@/lib/session";
import { actorLabel } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { formatDateKey } from "@/lib/work-hours";

const ASSIGNMENT_TYPES = ["appointment", "work_order", "task", "other"] as const;

function requireAdmin(req: NextRequest) {
  const session = sessionFromRequest(req);
  return session?.role === "admin" ? session : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Everything scheduled in a date range, with the linked job's details. */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const from = p.get("from") || "";
  const to = p.get("to") || "";
  const conds = [];
  if (DATE_RE.test(from)) conds.push(gte(assignments.workDate, from));
  if (DATE_RE.test(to)) conds.push(lte(assignments.workDate, to));
  const userId = parseInt(p.get("userId") || "", 10);
  if (!isNaN(userId)) conds.push(eq(assignments.userId, userId));

  const db = await getDb();
  const rows = await db
    .select({
      assignment: assignments,
      userName: users.name,
      jobNumber: entries.jobNumber,
      jobStatus: entries.jobStatus,
    })
    .from(assignments)
    .leftJoin(users, eq(assignments.userId, users.id))
    .leftJoin(entries, eq(assignments.entryId, entries.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(assignments.workDate), asc(assignments.startTime));

  return NextResponse.json({ assignments: rows });
}

export async function POST(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId);
  const workDate = String(body.workDate || "").trim();
  const type = ASSIGNMENT_TYPES.includes(body.type) ? body.type : "task";
  if (!userId) return NextResponse.json({ error: "Choose a technician" }, { status: 400 });
  if (!DATE_RE.test(workDate)) return NextResponse.json({ error: "Choose a valid date" }, { status: 400 });

  const startTime = String(body.startTime || "").trim();
  const endTime = String(body.endTime || "").trim();
  if (startTime && !TIME_RE.test(startTime)) return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  if (endTime && !TIME_RE.test(endTime)) return NextResponse.json({ error: "Invalid end time" }, { status: 400 });

  const db = await getDb();
  const [tech] = await db.select().from(users).where(eq(users.id, userId));
  if (!tech) return NextResponse.json({ error: "Technician not found" }, { status: 404 });

  const entryId = Number(body.entryId) || null;
  let title = String(body.title || "").trim();
  let customerName = String(body.customerName || "").trim();

  if (type === "work_order") {
    if (!entryId) return NextResponse.json({ error: "Choose the work order to attach" }, { status: 400 });
    const rows = await db
      .select({
        id: entries.id,
        jobNumber: entries.jobNumber,
        firstName: customers.firstName,
        lastName: customers.lastName,
        vehicleYear: entries.vehicleYear,
        vehicleMake: entries.vehicleMake,
        vehicleModel: entries.vehicleModel,
      })
      .from(entries)
      .leftJoin(customers, eq(entries.customerId, customers.id))
      .where(and(eq(entries.id, entryId), isNull(entries.deletedAt)));
    if (!rows.length) return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    const e = rows[0];
    // Fill the label from the job so the calendar reads well without extra typing.
    customerName = customerName || `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
    title =
      title ||
      `Job ${e.jobNumber || `#${e.id}`} — ${[e.vehicleYear, e.vehicleMake, e.vehicleModel].filter(Boolean).join(" ") || "vehicle"}`;
  }
  if (type === "appointment" && !customerName && !title) {
    return NextResponse.json({ error: "Add the customer name or a short detail" }, { status: 400 });
  }
  if (!title) title = customerName || "Scheduled work";

  const [created] = await db
    .insert(assignments)
    .values({
      userId,
      workDate,
      startTime,
      endTime,
      type,
      title,
      customerName,
      details: String(body.details || "").trim(),
      entryId: type === "work_order" ? entryId : Number(body.entryId) || null,
      createdBy: session.name,
    })
    .returning();

  await logActivity({
    action: "assignment.create",
    entity: "assignment",
    entityId: created.id,
    summary: `Scheduled ${tech.name} — ${title} on ${formatDateKey(workDate)}${startTime ? ` at ${startTime}` : ""}`,
    details: { type, entryId: created.entryId, userId },
    actor: actorLabel(session),
    req,
  });

  return NextResponse.json({ assignment: created });
}

export async function PUT(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.details === "string") patch.details = body.details.trim();
  if (typeof body.customerName === "string") patch.customerName = body.customerName.trim();
  if (DATE_RE.test(String(body.workDate || ""))) patch.workDate = body.workDate;
  if (typeof body.startTime === "string" && (body.startTime === "" || TIME_RE.test(body.startTime))) {
    patch.startTime = body.startTime;
  }
  if (["scheduled", "done", "cancelled"].includes(body.status)) patch.status = body.status;
  if (Number(body.userId)) patch.userId = Number(body.userId);

  const db = await getDb();
  await db.update(assignments).set(patch).where(eq(assignments.id, id));
  await logActivity({
    action: "assignment.update",
    entity: "assignment",
    entityId: id,
    summary: `Updated assignment #${id}`,
    details: { ...patch, updatedAt: undefined },
    actor: actorLabel(session),
    req,
  });
  const [row] = await db.select().from(assignments).where(eq(assignments.id, id));
  return NextResponse.json({ assignment: row });
}

export async function DELETE(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });

  const db = await getDb();
  await db.delete(assignments).where(eq(assignments.id, id));
  await logActivity({
    action: "assignment.delete",
    entity: "assignment",
    entityId: id,
    summary: `Removed assignment #${id}`,
    actor: actorLabel(session),
    req,
  });
  return NextResponse.json({ ok: true });
}
