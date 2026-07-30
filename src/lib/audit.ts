import type { NextRequest } from "next/server";
import { getDb, activityLog } from "@/db";

export type ActivityInput = {
  action: string;
  entity?: string;
  entityId?: number | null;
  summary: string;
  details?: unknown;
  req?: NextRequest;
  actor?: string;
};

function clientIp(req?: NextRequest): string {
  if (!req) return "";
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/**
 * Append an entry to the audit trail. Never throws — logging must not break the
 * operation it is recording.
 */
export async function logActivity(input: ActivityInput): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(activityLog).values({
      action: input.action,
      entity: input.entity || "",
      entityId: input.entityId ?? null,
      summary: input.summary,
      details: (input.details ?? null) as object | null,
      actor: input.actor || "",
      ip: clientIp(input.req),
    });
  } catch (err) {
    console.error("audit log failed:", err);
  }
}

/** Compute a compact diff between two objects for logging updates. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: string[]
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    // Compare as strings to avoid noise from number/string/date formatting.
    if (String(a ?? "") !== String(b ?? "")) changes[k] = { from: a ?? "", to: b ?? "" };
  }
  return changes;
}
