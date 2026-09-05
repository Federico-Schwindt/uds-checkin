import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, requests, users } from "@/db";
import { sessionFromRequest } from "@/lib/session";
import { actorLabel } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { addRequestMessage, emailRequest, loadRequest, REQUEST_STATUSES } from "@/lib/requests";

async function guard(req: NextRequest, id: number) {
  const session = sessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const data = await loadRequest(id);
  if (!data) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  // A technician may only ever see their own thread.
  if (session.role !== "admin" && data.request.userId !== session.uid) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  return { session, data };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const g = await guard(req, parseInt(id, 10));
  if (g.error) return g.error;

  // Opening the thread clears the unread marker for whoever is reading it.
  const db = await getDb();
  const patch =
    g.session!.role === "admin" ? { unreadForAdmin: false } : { unreadForUser: false };
  await db.update(requests).set(patch).where(eq(requests.id, g.data!.request.id));

  return NextResponse.json(g.data);
}

/** Adds a reply, and/or changes the status (admins only for status). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  const g = await guard(req, id);
  if (g.error) return g.error;
  const session = g.session!;
  const current = g.data!.request;

  const body = await req.json().catch(() => ({}));
  const db = await getDb();
  const message = String(body.body || "").trim();
  const nextStatus =
    session.role === "admin" && REQUEST_STATUSES.includes(body.status) ? (body.status as string) : "";

  if (!message && !nextStatus) {
    return NextResponse.json({ error: "Write a reply or choose a status" }, { status: 400 });
  }

  if (message) {
    await addRequestMessage({
      requestId: id,
      authorRole: session.role === "admin" ? "admin" : "tech",
      authorName: session.name,
      body: message,
    });
    // Keep the email thread in step so the manager sees replies in their inbox too.
    try {
      const [owner] = await db.select().from(users).where(eq(users.id, current.userId));
      await emailRequest(current, { name: owner?.name || session.name, role: session.role }, message);
    } catch (err) {
      console.error("request reply email failed", err);
    }
  }

  if (nextStatus && nextStatus !== current.status) {
    await db
      .update(requests)
      .set({ status: nextStatus, updatedAt: new Date(), unreadForUser: true })
      .where(eq(requests.id, id));
    await logActivity({
      action: "request.status",
      entity: "request",
      entityId: id,
      summary: `Request #${id} marked ${nextStatus}`,
      details: { from: current.status, to: nextStatus },
      actor: actorLabel(session),
      req,
    });
  }

  return NextResponse.json(await loadRequest(id));
}
