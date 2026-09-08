import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, performanceEvents, users } from "@/db";
import { sessionFromRequest } from "@/lib/session";
import { actorLabel } from "@/lib/auth";
import { logActivity } from "@/lib/audit";
import { getShopConfig } from "@/lib/settings";
import { currentPeriod, getEvents, getTeamStats } from "@/lib/performance";
import { pointsFor, SEVERITIES } from "@/lib/performance-config";
import { monthRange } from "@/lib/work-hours";

function requireAdmin(req: NextRequest) {
  const session = sessionFromRequest(req);
  return session?.role === "admin" ? session : null;
}

/** Team scores for a period (`?month=YYYY-MM`), or one technician's ledger (`?userId=`). */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const config = await getShopConfig();
  const monthParam = req.nextUrl.searchParams.get("month") || "";
  const period = /^\d{4}-\d{2}$/.test(monthParam) ? monthRange(`${monthParam}-01`) : currentPeriod(new Date(), config);

  const userIdParam = req.nextUrl.searchParams.get("userId");
  if (userIdParam) {
    const userId = parseInt(userIdParam, 10);
    const [stats] = await getTeamStats(config, period, { userId });
    return NextResponse.json({ period, stats: stats || null, events: await getEvents(userId) });
  }

  return NextResponse.json({ period, team: await getTeamStats(config, period) });
}

/** Flags a mistake, records praise, or applies a manual adjustment. */
export async function POST(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId);
  if (!userId) return NextResponse.json({ error: "Select a technician" }, { status: 400 });

  // Typing a target score is always an adjustment — severity has no meaning there.
  const settingScore = body.setScore !== undefined && body.setScore !== null && body.setScore !== "";
  const type = settingScore
    ? "adjustment"
    : ["mistake", "praise", "adjustment"].includes(body.type)
      ? body.type
      : "mistake";
  const severity = type === "mistake" && SEVERITIES.includes(body.severity) ? body.severity : "";
  if (type === "mistake" && !severity) {
    return NextResponse.json({ error: "Choose a severity: minor, major or critical" }, { status: 400 });
  }

  const db = await getDb();
  const [tech] = await db.select().from(users).where(eq(users.id, userId));
  if (!tech) return NextResponse.json({ error: "Technician not found" }, { status: 404 });

  const config = await getShopConfig();
  const period = currentPeriod(new Date(), config);

  // `setScore` lets the admin type the score they want; the delta is worked out
  // here from the live score so two admins can't race each other into a wrong total.
  let points: number;
  if (settingScore) {
    const target = Math.round(Number(body.setScore));
    if (!isFinite(target) || target < 0 || target > 100) {
      return NextResponse.json({ error: "A score must be between 0 and 100" }, { status: 400 });
    }
    const [before] = await getTeamStats(config, period, { userId });
    points = target - (before?.score ?? config.scoring.baseScore);
  } else if (body.points === undefined || body.points === null || body.points === "") {
    // No amount given — fall back to the suggested weight for this severity.
    points = pointsFor(config.scoring, type, severity);
  } else {
    points = Math.round(Number(body.points)) || 0;
  }
  if (!isFinite(points) || Math.abs(points) > 100) {
    return NextResponse.json({ error: "Points must be between -100 and 100" }, { status: 400 });
  }

  const [row] = await db
    .insert(performanceEvents)
    .values({
      userId,
      entryId: Number(body.entryId) || null,
      type,
      severity,
      category: String(body.category || "").trim(),
      note: String(body.note || "").trim(),
      points,
      createdBy: session.name,
    })
    .returning();

  const [after] = await getTeamStats(config, period, { userId });

  await logActivity({
    action: `performance.${type}`,
    // Tied to the job when it came from one, so it shows on that job's history;
    // the technician's own ledger is read from performance_events either way.
    entity: row.entryId ? "entry" : "user",
    entityId: row.entryId ?? userId,
    summary:
      type === "mistake"
        ? `Flagged a ${severity} mistake for ${tech.name}${row.entryId ? ` on entry #${row.entryId}` : ""} (${points} pts)`
        : `${type === "praise" ? "Recognized" : "Adjusted"} ${tech.name} (${points > 0 ? "+" : ""}${points} pts)`,
    details: { category: row.category, note: row.note, entryId: row.entryId, technician: tech.name },
    actor: actorLabel(session),
    req,
  });

  return NextResponse.json({ event: row, score: after?.score ?? null });
}

/** Retracts an event — mistakes do get logged against the wrong person. */
export async function DELETE(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "Id required" }, { status: 400 });

  const db = await getDb();
  const [row] = await db.select().from(performanceEvents).where(eq(performanceEvents.id, id));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.delete(performanceEvents).where(eq(performanceEvents.id, id));

  await logActivity({
    action: "performance.delete",
    entity: "user",
    entityId: row.userId,
    summary: `Removed a ${row.type} record (${row.points} pts)`,
    details: { category: row.category, note: row.note, entryId: row.entryId },
    actor: actorLabel(session),
    req,
  });

  const config = await getShopConfig();
  const [after] = await getTeamStats(config, currentPeriod(new Date(), config), { userId: row.userId });
  return NextResponse.json({ ok: true, score: after?.score ?? null });
}
