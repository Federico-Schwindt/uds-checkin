// Self-test of the online-store integration (src/lib/integration.ts) against real Postgres (PGlite, in memory) with
// this app's own schema and bootstrap. No server, no network, nothing written to disk. Run from the repo root:
//   npx esbuild scripts/integration-selftest.ts --bundle --platform=node --format=esm --packages=external --outfile=/tmp/selftest.mjs && node /tmp/selftest.mjs
// Prints "all N checks passed" or the failing checks (exit code 1).
import { createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { bootstrap } from "@/db/bootstrap";
import { CANCEL_MARK, IntegrationError, updateWebOrder, upsertWebOrder, verifySignature, webOrderSchema, webOrderStatuses, webOrderUpdateSchema } from "@/lib/integration";

let failures = 0, checks = 0;
const ok = (cond: unknown, msg: string) => { checks++; if (!cond) { failures++; console.log("  FAIL", msg); } };
const eqv = (a: unknown, b: unknown, msg: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);
async function throws(p: Promise<unknown>, status: number, msg: string) {
  try { await p; ok(false, msg + " (no error)"); } catch (e) { ok(e instanceof IntegrationError && e.status === status, `${msg}: ${e instanceof IntegrationError ? e.status : e}`); }
}

const client = new PGlite();
const db = drizzle(client, { schema }) as any;
await bootstrap(db);
const { entries, customers, parts, statusHistory, activityLog } = schema;

// ---- signature
const secret = "s".repeat(40), now = 1_800_000_000;
const sign = (ts: number, m: string, path: string, body: string) => "sha256=" + createHmac("sha256", secret).update(`${ts}.${m}.${path}.${body}`).digest("hex");
const good = { secret, timestamp: String(now), signature: sign(now, "PUT", "/api/integrations/web-orders/UDS-1", "{}"), method: "PUT", path: "/api/integrations/web-orders/UDS-1", body: "{}", now };
eqv(verifySignature(good), { ok: true }, "good signature");
eqv(verifySignature({ ...good, body: '{"x":1}' }).ok, false, "body changed");
eqv(verifySignature({ ...good, path: "/api/integrations/web-orders/UDS-2" }).ok, false, "path changed");
eqv(verifySignature({ ...good, method: "PATCH" }).ok, false, "method changed");
eqv(verifySignature({ ...good, now: now + 301 }), { ok: false, status: 401, error: "Stale or missing timestamp" }, "replay after 5 min");
eqv(verifySignature({ ...good, secret: "short" }).ok === false && (verifySignature({ ...good, secret: "short" }) as any).status, 503, "no secret configured");
eqv(verifySignature({ ...good, signature: null }).ok, false, "no signature");

// ---- create
const order = (over: any = {}) => webOrderSchema.parse({
  order: "UDS-261111-AB12",
  customer: { firstName: "Alex", lastName: "Morgan", phone: "+1 (813) 555-0142", street: "12 Test St", city: "Tampa", state: "FL", zip: "33601", country: "United States" },
  entry: { notes: "ONLINE ORDER UDS-261111-AB12\nSeries: 1350", laborRequest: "Custom Made Driveshaft", driveshaftPieces: "1 Piece", driveshaftMaterial: "Steel",
    designerType: "One Piece", measurementA: '52.25"', total: 919.51, payment: "Paid", productImage: "https://universaldriveshafts.com/online-builder/drawing?f=trans&r=flange&a1=52.25&c1=48",
    custom: { "Online order": "UDS-261111-AB12", "Series": "1350 Series" } },
  parts: [{ sku: "", name: "Custom 1350 driveshaft", qty: 1, price: 832.38 }, { sku: "2-2-1379U", name: "Rear yoke: 2-2-1379", qty: 1, price: 87.13 }],
  ...over,
});
const r1 = await upsertWebOrder(db, "UDS-261111-AB12", order());
eqv([r1.created, r1.deleted], [true, false], "created");
const [e1] = await db.select().from(entries).where(eq(entries.id, r1.id));
eqv([e1.jobNumber, e1.jobStatus, e1.payment, e1.createdByName, e1.total, e1.measurementA], ["UDS-261111-AB12", "New", "Paid", "Online store", "919.51", '52.25"'], "entry row");
ok(e1.productImage.startsWith("https://universaldriveshafts.com/online-builder/drawing"), "drawing as product image");
eqv([e1.custom["Online order"], e1.custom["Series"], e1.custom["__order"]], ["UDS-261111-AB12", "1350 Series", ["Online order", "Series"]], "additional information, with the store's order kept");
const [c1] = await db.select().from(customers).where(eq(customers.id, e1.customerId));
eqv([c1.phone, c1.email, c1.smsConsent, c1.city], ["8135550142", "", false, "Tampa"], "silent customer row");
eqv((await db.select().from(parts).where(eq(parts.entryId, r1.id))).map((p: any) => [p.sku, p.price]), [["", "832.38"], ["2-2-1379U", "87.13"]], "parts pick list");
eqv((await db.select().from(statusHistory).where(eq(statusHistory.entryId, r1.id))).map((s: any) => [s.fromStatus, s.toStatus, s.changedBy]), [["", "New", "Online store"]], "first status row");
const log1 = (await db.select().from(activityLog).where(eq(activityLog.entityId, r1.id)))[0];
ok(log1 && log1.action === "entry.create" && log1.actor === "Online store" && log1.summary.includes("(Job UDS-261111-AB12)"), "audit row");

// a repeat (the store retried) never makes a second work order and leaves the shop's edits alone
await db.update(entries).set({ notes: "edited by the shop" }).where(eq(entries.id, r1.id));
const r1b = await upsertWebOrder(db, "UDS-261111-AB12", order());
eqv([r1b.id, r1b.created], [r1.id, false], "idempotent repeat");
eqv((await db.select().from(entries).where(eq(entries.id, r1.id)))[0].notes, "edited by the shop", "repeat changes nothing");

// a returning web customer keeps their row; a walk-in with the same phone and name is never borrowed
const walkIn = (await db.insert(customers).values({ firstName: "Sam", lastName: "Lee", phone: "7275550199", email: "sam@example.com", smsConsent: true }).returning({ id: customers.id }))[0].id;
const r2 = await upsertWebOrder(db, "UDS-261111-CD34", order({ order: "UDS-261111-CD34", customer: { firstName: "Sam", lastName: "Lee", phone: "727-555-0199" } }));
const e2 = (await db.select().from(entries).where(eq(entries.id, r2.id)))[0];
ok(e2.customerId !== walkIn, "walk-in not borrowed");
const r3 = await upsertWebOrder(db, "UDS-261111-EF56", order({ order: "UDS-261111-EF56", customer: { firstName: "Sam", lastName: "Lee", phone: "727-555-0199", city: "Odessa" } }));
const e3 = (await db.select().from(entries).where(eq(entries.id, r3.id)))[0];
eqv([e3.customerId === e2.customerId, (await db.select().from(customers).where(eq(customers.id, e3.customerId)))[0].city], [true, "Odessa"], "returning web customer reuses its row");

// a job number the shop typed at the counter is not the store's to touch
await db.insert(entries).values({ jobNumber: "SHOP-777", createdByName: "Maria" });
await throws(upsertWebOrder(db, "SHOP-777", order()), 409, "shop job number refused");
await throws(updateWebOrder(db, "SHOP-777", webOrderUpdateSchema.parse({ payment: "Paid" })), 409, "shop entry not updatable");
await throws(upsertWebOrder(db, "bad job!", order()), 400, "job number format");
await throws(updateWebOrder(db, "UDS-NOPE-1", webOrderUpdateSchema.parse({ payment: "Paid" })), 404, "unknown job");

// payload validation (the station decides what it accepts)
const bad = (p: any) => webOrderSchema.safeParse(p).success;
eqv(bad({ ...order(), entry: { ...order().entry, productImage: "javascript:alert(1)" } }), false, "product image must be https");
eqv(bad({ ...order(), entry: { ...order().entry, payment: "Free" } }), false, "payment values");
eqv(bad({ ...order(), customer: { ...order().customer, firstName: "" } }), false, "name required");
eqv(bad({ ...order(), parts: Array.from({ length: 21 }, () => ({ name: "x", qty: 1, price: 1 })) }), false, "parts capped");

// ---- updates
const up = (job: string, u: any) => updateWebOrder(db, job, webOrderUpdateSchema.parse({ order: job, ...u }));
const pick = await upsertWebOrder(db, "UDS-PICKUP-1", order({ order: "UDS-PICKUP-1", entry: { ...order().entry, payment: "Unpaid" } }));
eqv((await up("UDS-PICKUP-1", { payment: "Paid" })).changed, ["payment"], "paid later");
eqv((await up("UDS-PICKUP-1", { payment: "Paid" })).changed, [], "paid twice: nothing");

await upsertWebOrder(db, "UDS-CANCEL-1", order({ order: "UDS-CANCEL-1" }));
await db.update(entries).set({ jobStatus: "Ongoing" }).where(eq(entries.jobNumber, "UDS-CANCEL-1"));
const cx = await up("UDS-CANCEL-1", { cancel: { reason: "cancelled" } });
eqv([cx.changed, cx.status], [["notes", "onHoldReason", "jobStatus"], "On hold"], "cancel → on hold");
const ec = (await db.select().from(entries).where(eq(entries.jobNumber, "UDS-CANCEL-1")))[0];
ok(ec.notes.startsWith(CANCEL_MARK) && ec.notes.includes("ONLINE ORDER UDS-261111-AB12") && ec.onHoldReason === "Order cancelled online", "cancel line on top, build sheet kept");
eqv((await db.select().from(statusHistory).where(eq(statusHistory.entryId, ec.id))).map((s: any) => [s.fromStatus, s.toStatus, s.note]).pop(), ["Ongoing", "On hold", "Order cancelled in the online store"], "status history");
eqv((await up("UDS-CANCEL-1", { cancel: { reason: "cancelled" } })).changed, [], "cancel twice: nothing");
eqv((await up("UDS-CANCEL-1", { complete: { note: "Shipped" } })).changed, [], "a cancelled order is never completed");

await upsertWebOrder(db, "UDS-BUILT-1", order({ order: "UDS-BUILT-1" }));
await db.update(entries).set({ jobStatus: "Completed" }).where(eq(entries.jobNumber, "UDS-BUILT-1"));
const cb = await up("UDS-BUILT-1", { cancel: { reason: "refunded" } });
eqv([cb.changed, cb.status], [["notes"], "Completed"], "refund after the shaft was built: only the line");

await upsertWebOrder(db, "UDS-SHIP-1", order({ order: "UDS-SHIP-1" }));
const sh = await up("UDS-SHIP-1", { complete: { note: "Shipped from the online store (UPS 1Z999)" } });
eqv([sh.changed, sh.status], [["jobStatus"], "Completed"], "shipped → completed");
eqv((await db.select().from(statusHistory).where(eq(statusHistory.entryId, sh.id))).map((s: any) => s.note).pop(), "Shipped from the online store (UPS 1Z999)", "ship note");

// a deleted web work order is reported, not recreated, not updated
await db.update(entries).set({ deletedAt: new Date() }).where(eq(entries.jobNumber, "UDS-SHIP-1"));
eqv((await upsertWebOrder(db, "UDS-SHIP-1", order())).deleted, true, "deleted not recreated");
await throws(up("UDS-SHIP-1", { payment: "Paid" }), 404, "deleted not updated");

// ---- statuses
const st = await webOrderStatuses(db, ["UDS-261111-AB12", "UDS-CANCEL-1", "UDS-SHIP-1", "SHOP-777", "x y"]);
const byJob = Object.fromEntries(st.map((s: any) => [s.job, [s.status, s.cancelled, s.deleted]]));
eqv(byJob, { "UDS-261111-AB12": ["New", false, false], "UDS-CANCEL-1": ["On hold", true, false], "UDS-SHIP-1": ["Completed", false, true] }, "statuses (shop entries never listed)");

console.log(failures ? `${failures} of ${checks} checks FAILED` : `all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
