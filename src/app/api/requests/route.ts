import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, requests, users } from "@/db";
import { sessionFromRequest } from "@/lib/session";
import { actorLabel } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { addRequestMessage, emailRequest, listRequests, newRequestToken, REQUEST_TYPES } from "@/lib/requests";

const TYPE_VALUES = new Set(REQUEST_TYPES.map((t) => t.value as string));

/** Admins see the whole inbox; a technician sees only their own threads. */
export async function GET(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") || "";
  const rows = await listRequests({
    userId: session.role === "admin" ? undefined : session.uid,
    status: status || undefined,
  });
  return NextResponse.json({ requests: rows });
}

export async function POST(req: NextRequest) {
  const session = sessionFromRequest(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject || "").trim();
  const message = String(body.body || "").trim();
  if (!subject) return NextResponse.json({ error: "Give your request a short title" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Explain what you need" }, { status: 400 });

  const type = TYPE_VALUES.has(body.type) ? body.type : "other";
  // An admin can log a request on someone's behalf; everyone else files their own.
  const userId = session.role === "admin" && Number(body.userId) ? Number(body.userId) : session.uid;

  const db = await getDb();
  const [author] = await db.select().from(users).where(eq(users.id, userId));
  if (!author) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });

  const [created] = await db
    .insert(requests)
    .values({
      userId,
      type,
      subject,
      requestedDate: String(body.requestedDate || "").trim(),
      requestedEndDate: String(body.requestedEndDate || "").trim(),
      token: newRequestToken(),
      unreadForAdmin: true,
    })
    .returning();

  await addRequestMessage({
    requestId: created.id,
    authorRole: session.role === "admin" ? "admin" : "tech",
    authorName: session.name,
    body: message,
  });

  // The email carries the token, so a reply from the manager threads back here.
  let emailed = false;
  try {
    const r = await emailRequest(created, { name: author.name, role: session.role }, message, { isNew: true });
    emailed = r.ok;
  } catch (err) {
    console.error("request email failed", err);
  }

  await logActivity({
    action: "request.create",
    entity: "request",
    entityId: created.id,
    summary: `${author.name} submitted a request: ${subject}`,
    details: { type, token: created.token, emailed },
    actor: actorLabel(session),
    req,
  });

  return NextResponse.json({ request: created, emailed });
}
