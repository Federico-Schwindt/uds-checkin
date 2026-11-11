import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { activityLog, customers, entries, locations, parts, statusHistory, type Db } from "@/db";
import { normalizePhone } from "@/lib/utils";
import { BUILD_KEY, CUSTOM_ORDER_KEY } from "@/lib/integration-shared";

/**
 * Online-store integration: the store (universaldriveshafts.com) turns each custom driveshaft it sells into a work
 * order here, keeps it in step with the order (paid, cancelled, shipped) and reads its status back. It used to write
 * straight into this database with the app's own credentials; now it only holds a shared secret and every write goes
 * through this module, with the same validation, transaction and audit trail as the check-in form.
 *
 * Requests are signed: X-UDS-Timestamp (unix seconds) and X-UDS-Signature = "sha256=" + hex HMAC-SHA256 of
 * `${timestamp}.${METHOD}.${path with query}.${raw body}` with INTEGRATION_SECRET. Five minutes of clock skew allowed.
 * Web orders are silent towards the customer (no e-mail, no SMS consent on their row): the store confirms, ships and
 * tracks them in its own words. Only work orders this integration created can be read or changed through it.
 */

export const INTEGRATION_ACTOR = "Online store";
/** First line put on top of a cancelled web order's notes; also how a repeat knows it is already done. */
export const CANCEL_MARK = "*** CANCELLED ONLINE — DO NOT BUILD ***";
const MAX_SKEW_S = 300;

export type VerifyResult = { ok: true } | { ok: false; status: number; error: string };

/** Reads the raw body once and checks its signature against INTEGRATION_SECRET. */
export async function readSigned(req: Request): Promise<{ body: string; check: VerifyResult }> {
  const body = await req.text();
  const url = new URL(req.url);
  const check = verifySignature({
    secret: process.env.INTEGRATION_SECRET, timestamp: req.headers.get("x-uds-timestamp"), signature: req.headers.get("x-uds-signature"),
    method: req.method, path: url.pathname + url.search, body,
  });
  return { body, check };
}

/** Checks the request signature. Pure: the caller passes the secret, the clock and the raw request parts. */
export function verifySignature(input: {
  secret: string | undefined;
  timestamp: string | null;
  signature: string | null;
  method: string;
  path: string;
  body: string;
  now?: number;
}): VerifyResult {
  const secret = input.secret || "";
  if (secret.length < 32) return { ok: false, status: 503, error: "Integration is not configured" };
  const ts = Number(input.timestamp);
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(ts) || Math.abs(now - ts) > MAX_SKEW_S) return { ok: false, status: 401, error: "Stale or missing timestamp" };
  const expected = "sha256=" + createHmac("sha256", secret).update(`${ts}.${input.method.toUpperCase()}.${input.path}.${input.body}`).digest("hex");
  const got = Buffer.from(input.signature || "");
  const want = Buffer.from(expected);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, status: 401, error: "Bad signature" };
  return { ok: true };
}

const text = (max: number) => z.string().trim().max(max).default("");
const httpsUrl = z.string().trim().max(2000).refine((v) => v === "" || /^https:\/\/[^\s"'<>]+$/.test(v), "must be an https URL").default("");

/** The build as the online builder knows it, grouped for the "Online build" card (see lib/integration-shared OnlineBuild). */
const buildSchema = z.object({
  title: text(200),
  subtitle: text(200),
  highlights: z.array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(80) })).max(8).default([]),
  sections: z.array(z.object({
    title: z.string().trim().min(1).max(60),
    rows: z.array(z.tuple([z.string().trim().min(1).max(80), z.string().trim().max(600)])).max(30),
  })).min(1).max(10),
  links: z.object({ build: httpsUrl, drawing: httpsUrl }).default({ build: "", drawing: "" }),
  note: text(600),
});

/** JSON with keys sorted: jsonb hands objects back in its own key order, so plain stringify would always differ. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

export const webOrderSchema = z.object({
  order: z.string().trim().min(1).max(60),
  customer: z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().max(40),
    companyName: text(120),
    street: text(190),
    address2: text(190),
    city: text(120),
    state: text(60),
    zip: text(20),
    country: text(60),
  }),
  entry: z.object({
    notes: text(20000),
    laborRequest: text(80),
    driveshaftPieces: text(40),
    driveshaftMaterial: text(40),
    designerType: text(40),
    measurementA: text(40),
    measurementB: text(40),
    measurementC: text(40),
    total: z.number().min(0).max(1_000_000).nullable().default(null),
    payment: z.enum(["Paid", "Unpaid", ""]).default(""),
    productImage: httpsUrl,
    custom: z.record(z.string().max(80), z.union([z.string().max(2000), z.number(), z.boolean()])).default({}),
    build: buildSchema.optional(),
  }),
  parts: z
    .array(z.object({ sku: text(80), name: z.string().trim().min(1).max(250), qty: z.number().int().min(1).max(999), price: z.number().min(0).max(1_000_000) }))
    .max(20)
    .default([]),
});
export type WebOrder = z.infer<typeof webOrderSchema>;

export const webOrderUpdateSchema = z.object({
  order: z.string().trim().max(60).default(""),
  /** The order was paid after the work order was made (pay at pickup, an invoice, a card that cleared). */
  payment: z.enum(["Paid"]).optional(),
  /** The order was cancelled or refunded in the store. */
  cancel: z.object({ reason: z.enum(["cancelled", "refunded"]) }).optional(),
  /** The order shipped or was completed in the store. */
  complete: z.object({ note: text(200) }).optional(),
  /** The store's build card, refreshed (the order was edited, or the store lays it out better); notes stay the shop's. */
  build: buildSchema.optional(),
});
export type WebOrderUpdate = z.infer<typeof webOrderUpdateSchema>;

export class IntegrationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The web work order for a job number (only ones this integration made), or null. Deleted ones included. */
async function findWebEntry(db: Db | Tx, job: string) {
  const rows = await db.select().from(entries).where(eq(entries.jobNumber, job));
  const mine = rows.filter((r) => r.createdByName === INTEGRATION_ACTOR);
  if (rows.length && !mine.length) throw new IntegrationError(409, `Job ${job} belongs to a check-in made at the shop`);
  return mine.find((r) => !r.deletedAt) || mine[0] || null;
}

/**
 * Creates the work order for a job number, once. A repeat returns the existing one untouched (the shop may have
 * edited it); a deleted one is not brought back. Customer, entry, parts, first status row and the audit row are
 * written in one transaction.
 */
export async function upsertWebOrder(db: Db, job: string, input: WebOrder): Promise<{ id: number; created: boolean; deleted: boolean }> {
  if (!/^[A-Za-z0-9-]{3,60}$/.test(job)) throw new IntegrationError(400, "Invalid job number");
  const phone = normalizePhone(input.customer.phone);
  return db.transaction(async (tx) => {
    const existing = await findWebEntry(tx, job);
    if (existing) return { id: existing.id, created: false, deleted: !!existing.deletedAt };

    // a returning web customer keeps their silent row; a customer who checked in at the counter is never borrowed,
    // or the shop's status changes could text them about this shaft
    const values = {
      firstName: input.customer.firstName, lastName: input.customer.lastName, phone, companyName: input.customer.companyName,
      street: input.customer.street, address2: input.customer.address2, city: input.customer.city, state: input.customer.state,
      zip: input.customer.zip, country: input.customer.country || "United States", email: "", smsConsent: false, updatedAt: new Date(),
    };
    const [known] = await tx.select({ id: customers.id }).from(customers).where(and(
      eq(customers.phone, phone), eq(customers.firstName, values.firstName), eq(customers.lastName, values.lastName),
      eq(customers.email, ""), eq(customers.smsConsent, false),
    )).limit(1);
    let customerId: number;
    if (known) {
      customerId = known.id;
      await tx.update(customers).set(values).where(eq(customers.id, customerId));
    } else {
      customerId = (await tx.insert(customers).values(values).returning({ id: customers.id }))[0].id;
    }

    const [loc] = await tx.select({ id: locations.id }).from(locations).orderBy(locations.id).limit(1);
    const e = input.entry;
    const [row] = await tx.insert(entries).values({
      locationId: loc?.id ?? null, customerId, notes: e.notes, laborRequest: e.laborRequest, driveshaftPieces: e.driveshaftPieces,
      driveshaftMaterial: e.driveshaftMaterial, designerType: e.designerType, productImage: e.productImage,
      measurementA: e.measurementA, measurementB: e.measurementB, measurementC: e.measurementC,
      total: e.total === null ? null : e.total.toFixed(2), jobNumber: job, jobStatus: "New", payment: e.payment,
      // jsonb keeps keys in its own order (shortest first); CUSTOM_ORDER_KEY keeps the store's, for the Additional information card
      custom: Object.keys(e.custom).length || e.build
        ? { ...e.custom, ...(Object.keys(e.custom).length ? { [CUSTOM_ORDER_KEY]: Object.keys(e.custom) } : {}), ...(e.build ? { [BUILD_KEY]: e.build } : {}) }
        : null,
      createdByName: INTEGRATION_ACTOR,
    }).returning({ id: entries.id });
    if (input.parts.length) {
      await tx.insert(parts).values(input.parts.map((p) => ({ entryId: row.id, sku: p.sku, name: p.name, qty: p.qty, price: p.price.toFixed(2) })));
    }
    await tx.insert(statusHistory).values({ entryId: row.id, fromStatus: "", toStatus: "New", changedBy: INTEGRATION_ACTOR });
    await tx.insert(activityLog).values({
      action: "entry.create", entity: "entry", entityId: row.id,
      summary: `New check-in #${row.id} — ${values.firstName} ${values.lastName} (Job ${job}) · online order`,
      details: { source: "online store", order: input.order, jobStatus: "New", createdBy: INTEGRATION_ACTOR }, actor: INTEGRATION_ACTOR, ip: "",
    });
    return { id: row.id, created: true, deleted: false };
  });
}

/**
 * Applies what changed on the order since. Each part is decided against the current row, so a repeat changes nothing:
 *   payment → "Paid";
 *   cancel → "On hold" with the reason and a DO NOT BUILD line on top of the notes (a Completed shaft only gets the
 *            line; the work order is never deleted, the shop may have started);
 *   complete → "Completed" with the store's note, unless the order was cancelled.
 * Status moves get their status-history row; every change one "entry.update" audit row. No customer message.
 */
export async function updateWebOrder(db: Db, job: string, input: WebOrderUpdate): Promise<{ id: number; changed: string[]; status: string; payment: string }> {
  return db.transaction(async (tx) => {
    const e = await findWebEntry(tx, job);
    if (!e || e.deletedAt) throw new IntegrationError(404, `No web work order for job ${job}`);
    const patch: Partial<typeof entries.$inferInsert> = {};
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    let toStatus: string | null = null;
    let note = "";
    if (input.payment && e.payment !== input.payment) {
      patch.payment = input.payment;
      diff.payment = { from: e.payment, to: input.payment };
    }
    const cancelled = e.notes.includes(CANCEL_MARK);
    if (input.cancel && !cancelled) {
      const when = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
      patch.notes = `${CANCEL_MARK}\nOrder ${input.order || job} was ${input.cancel.reason} online on ${when} EST. If work already started, call the store before going on.\n\n${e.notes}`;
      diff.notes = { from: e.notes.slice(0, 160), to: patch.notes.slice(0, 160) };
      if (e.jobStatus !== "Completed") {
        toStatus = "On hold";
        note = `Order ${input.cancel.reason} in the online store`;
        patch.onHoldReason = `Order ${input.cancel.reason} online`;
        diff.onHoldReason = { from: e.onHoldReason, to: patch.onHoldReason };
      }
    }
    const custom = (e.custom as Record<string, unknown> | null) || {};
    if (input.build && canon(custom[BUILD_KEY]) !== canon(input.build)) {
      patch.custom = { ...custom, [BUILD_KEY]: input.build };
      diff.build = { from: custom[BUILD_KEY] ? "previous build card" : "", to: "build card from the online store" };
    }
    if (input.complete && !input.cancel && !cancelled && e.jobStatus !== "Completed") {
      toStatus = "Completed";
      note = input.complete.note || "Completed in the online store";
    }
    if (toStatus) patch.jobStatus = toStatus;
    const changed = [...Object.keys(diff), ...(toStatus ? ["jobStatus"] : [])];
    if (!changed.length) return { id: e.id, changed, status: e.jobStatus, payment: e.payment };

    await tx.update(entries).set({ ...patch, updatedAt: new Date() }).where(eq(entries.id, e.id));
    if (toStatus) await tx.insert(statusHistory).values({ entryId: e.id, fromStatus: e.jobStatus, toStatus, note, changedBy: INTEGRATION_ACTOR });
    if (Object.keys(diff).length) {
      await tx.insert(activityLog).values({
        action: "entry.update", entity: "entry", entityId: e.id,
        summary: `Edited entry #${e.id} (${Object.keys(diff).join(", ")}) · online order ${input.order || job}`,
        details: diff, actor: INTEGRATION_ACTOR, ip: "",
      });
    }
    return { id: e.id, changed, status: toStatus || e.jobStatus, payment: (patch.payment as string) || e.payment };
  });
}

/** Status of web work orders by job number (for the store's "we started / it is built" messages). */
export async function webOrderStatuses(db: Db, jobs: string[]) {
  const list = [...new Set(jobs.filter((j) => /^[A-Za-z0-9-]{3,60}$/.test(j)))].slice(0, 200);
  if (!list.length) return [];
  const rows = await db.select({ id: entries.id, job: entries.jobNumber, status: entries.jobStatus, payment: entries.payment, notes: entries.notes, deletedAt: entries.deletedAt, by: entries.createdByName })
    .from(entries).where(and(inArray(entries.jobNumber, list), eq(entries.createdByName, INTEGRATION_ACTOR)));
  const out = new Map<string, { job: string; id: number; status: string; payment: string; cancelled: boolean; deleted: boolean }>();
  for (const r of rows) {
    const cur = out.get(r.job);
    if (cur && !cur.deleted) continue;   // a live row wins over a deleted one with the same job number
    out.set(r.job, { job: r.job, id: r.id, status: r.status, payment: r.payment, cancelled: r.notes.includes(CANCEL_MARK), deleted: !!r.deletedAt });
  }
  return [...out.values()];
}

