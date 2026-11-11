import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { readSigned, webOrderStatuses } from "@/lib/integration";

/** GET /api/integrations/web-orders?jobs=A,B — status of the online store's work orders (signed, see lib/integration). */
export async function GET(req: NextRequest) {
  const { check } = await readSigned(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const jobs = (req.nextUrl.searchParams.get("jobs") || "").split(",").map((j) => j.trim()).filter(Boolean);
  return NextResponse.json({ entries: await webOrderStatuses(await getDb(), jobs) });
}
