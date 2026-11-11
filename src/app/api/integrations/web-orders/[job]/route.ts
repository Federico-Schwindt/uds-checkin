import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getDb } from "@/db";
import { IntegrationError, readSigned, updateWebOrder, upsertWebOrder, webOrderSchema, webOrderStatuses, webOrderUpdateSchema } from "@/lib/integration";
import { notifyForEntry } from "@/lib/notify";
import { logActivity } from "@/lib/audit";

/**
 * The online store's work order for one job number (signed requests only, see lib/integration):
 *   PUT    create it once (a repeat returns the existing one untouched)
 *   PATCH  paid / cancelled / shipped on the order since
 *   GET    its status
 */
type Ctx = { params: Promise<{ job: string }> };

function failure(err: unknown, req: NextRequest, job: string) {
  if (err instanceof IntegrationError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ZodError) return NextResponse.json({ error: "Invalid payload", issues: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  console.error("integration request failed", err);
  void logActivity({ action: "entry.create.error", entity: "entry", summary: `Online store request for job ${job} failed`, details: { error: String(err) }, req, actor: "Online store" });
  return NextResponse.json({ error: "Could not save the work order. Nothing was stored — retry." }, { status: 500 });
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const { job } = await ctx.params;
  const { body, check } = await readSigned(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  try {
    const input = webOrderSchema.parse(JSON.parse(body || "null"));
    const res = await upsertWebOrder(await getDb(), job, input);
    // the shop's own "new check-in" e-mail (Admin → Templates); never the customer's: the store talks to web customers
    if (res.created) {
      try { await notifyForEntry(res.id, "admin_submission"); } catch (err) { console.error("notify failed", err); }
    }
    return NextResponse.json(res, { status: res.created ? 201 : 200 });
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    return failure(err, req, job);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { job } = await ctx.params;
  const { body, check } = await readSigned(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  try {
    return NextResponse.json(await updateWebOrder(await getDb(), job, webOrderUpdateSchema.parse(JSON.parse(body || "null"))));
  } catch (err) {
    if (err instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    return failure(err, req, job);
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { job } = await ctx.params;
  const { check } = await readSigned(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const [row] = await webOrderStatuses(await getDb(), [job]);
  return row ? NextResponse.json(row) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
