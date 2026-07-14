// One-off migration: copy all data from the local PGlite dev DB to a Postgres
// target (Neon). Usage: node scripts/migrate-to-neon.mjs "<postgres-url>"
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import path from "node:path";

const target = process.argv[2] || process.env.DATABASE_URL;
if (!target) {
  console.error("Provide the target Postgres URL as an argument or DATABASE_URL.");
  process.exit(1);
}
const targetUrl = target.replace(/[?&]channel_binding=[^&]*/i, "");

// FK-safe order.
const TABLES = [
  "settings",
  "locations",
  "employees",
  "customers",
  "entries",
  "parts",
  "status_history",
  "message_templates",
  "message_log",
];

const DDL = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB);
CREATE TABLE IF NOT EXISTS locations (id SERIAL PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, twilio_from TEXT, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMP NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS employees (id SERIAL PRIMARY KEY, name TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', street TEXT NOT NULL DEFAULT '', address2 TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', state TEXT NOT NULL DEFAULT '', zip TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT 'United States', sms_consent BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (last_name, first_name);
CREATE TABLE IF NOT EXISTS entries (id SERIAL PRIMARY KEY, location_id INTEGER REFERENCES locations(id), customer_id INTEGER REFERENCES customers(id), estimate_choice TEXT NOT NULL DEFAULT '', estimate_amount TEXT NOT NULL DEFAULT '', estimate_signature TEXT NOT NULL DEFAULT '', estimate_date TEXT NOT NULL DEFAULT '', vehicle_year TEXT NOT NULL DEFAULT '', vehicle_make TEXT NOT NULL DEFAULT '', vehicle_model TEXT NOT NULL DEFAULT '', drive TEXT NOT NULL DEFAULT '', axle_location TEXT NOT NULL DEFAULT '', cab TEXT NOT NULL DEFAULT '', transmission TEXT NOT NULL DEFAULT '', transmission_speed TEXT NOT NULL DEFAULT '', engine_size TEXT NOT NULL DEFAULT '', bed_size TEXT NOT NULL DEFAULT '', bed_size_other TEXT NOT NULL DEFAULT '', wheelbase TEXT NOT NULL DEFAULT '', horse_power TEXT NOT NULL DEFAULT '', stock_vehicle TEXT NOT NULL DEFAULT '', stock_vehicle_explain TEXT NOT NULL DEFAULT '', vin_method TEXT NOT NULL DEFAULT '', vin_photo TEXT NOT NULL DEFAULT '', vin TEXT NOT NULL DEFAULT '', mileage TEXT NOT NULL DEFAULT '', save_old_parts TEXT NOT NULL DEFAULT '', complaint TEXT NOT NULL DEFAULT '', complaint_other TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', labor_request TEXT NOT NULL DEFAULT '', labor_other TEXT NOT NULL DEFAULT '', driveshaft_pieces TEXT NOT NULL DEFAULT '', driveshaft_material TEXT NOT NULL DEFAULT '', u_joint_serial TEXT NOT NULL DEFAULT '', driveshaft_type_choice TEXT NOT NULL DEFAULT '', product_image TEXT NOT NULL DEFAULT '', measurement_a TEXT NOT NULL DEFAULT '', measurement_b TEXT NOT NULL DEFAULT '', measurement_c TEXT NOT NULL DEFAULT '', designer_type TEXT NOT NULL DEFAULT '', how_heard TEXT NOT NULL DEFAULT '', deposit NUMERIC(10,2), total NUMERIC(10,2), final_signature TEXT NOT NULL DEFAULT '', job_number TEXT NOT NULL DEFAULT '', employee_name TEXT NOT NULL DEFAULT '', core TEXT NOT NULL DEFAULT '', job_status TEXT NOT NULL DEFAULT 'New', on_hold_reason TEXT NOT NULL DEFAULT '', payment TEXT NOT NULL DEFAULT '', confirmation_date TEXT NOT NULL DEFAULT '', assigned_employee TEXT NOT NULL DEFAULT '', time_of_job TEXT NOT NULL DEFAULT '', signing_date TEXT NOT NULL DEFAULT '', eta_job TEXT NOT NULL DEFAULT '', source_entry_id INTEGER, created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS entries_status_idx ON entries (job_status);
CREATE INDEX IF NOT EXISTS entries_customer_idx ON entries (customer_id);
CREATE INDEX IF NOT EXISTS entries_created_idx ON entries (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS entries_source_idx ON entries (source_entry_id);
CREATE TABLE IF NOT EXISTS parts (id SERIAL PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE, sku TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', qty INTEGER NOT NULL DEFAULT 1, price NUMERIC(10,2));
CREATE INDEX IF NOT EXISTS parts_entry_idx ON parts (entry_id);
CREATE TABLE IF NOT EXISTS status_history (id SERIAL PRIMARY KEY, entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE, from_status TEXT NOT NULL DEFAULT '', to_status TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS status_history_entry_idx ON status_history (entry_id);
CREATE TABLE IF NOT EXISTS message_templates (id SERIAL PRIMARY KEY, key TEXT NOT NULL, channel TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', enabled BOOLEAN NOT NULL DEFAULT true);
CREATE UNIQUE INDEX IF NOT EXISTS templates_key_channel_idx ON message_templates (key, channel);
CREATE TABLE IF NOT EXISTS message_log (id SERIAL PRIMARY KEY, entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL, channel TEXT NOT NULL, recipient TEXT NOT NULL DEFAULT '', template_key TEXT NOT NULL DEFAULT '', subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'queued', provider_id TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', created_at TIMESTAMP NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS message_log_entry_idx ON message_log (entry_id);
CREATE INDEX IF NOT EXISTS message_log_created_idx ON message_log (created_at);
`;

const local = new PGlite(path.join(process.cwd(), ".data", "pg"));
const sql = postgres(targetUrl, { max: 3 });

async function main() {
  console.log("Creating schema on target…");
  for (const stmt of DDL.split(";")) {
    const s = stmt.trim();
    if (s) await sql.unsafe(s);
  }

  // Wipe any seeded rows so the copy is authoritative.
  console.log("Clearing seeded rows on target…");
  await sql.unsafe(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);

  for (const table of TABLES) {
    const { rows } = await local.query(`SELECT * FROM ${table} ORDER BY 1`);
    if (rows.length === 0) {
      console.log(`  ${table}: 0 rows`);
      continue;
    }
    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `"${c}"`).join(", ");
    // settings.value is JSONB; PGlite returns it already parsed, so re-serialize.
    const isJsonb = (c) => table === "settings" && c === "value";
    // Insert in chunks to keep parameter counts sane.
    const chunk = 200;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk);
      const values = [];
      const placeholders = slice
        .map((row) => {
          const ph = cols.map((c) => {
            values.push(isJsonb(c) ? JSON.stringify(row[c] ?? null) : row[c]);
            return isJsonb(c) ? `$${values.length}::jsonb` : `$${values.length}`;
          });
          return `(${ph.join(", ")})`;
        })
        .join(", ");
      await sql.unsafe(`INSERT INTO ${table} (${colList}) VALUES ${placeholders}`, values);
    }
    console.log(`  ${table}: ${rows.length} rows`);
  }

  // Reset sequences so new inserts don't collide with copied ids.
  console.log("Resetting sequences…");
  for (const table of ["locations", "employees", "customers", "entries", "parts", "status_history", "message_templates", "message_log"]) {
    await sql.unsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`
    );
  }

  const counts = {};
  for (const table of TABLES) {
    const r = await sql.unsafe(`SELECT count(*)::int AS n FROM ${table}`);
    counts[table] = r[0].n;
  }
  console.log("\nTarget row counts:", JSON.stringify(counts));
  await sql.end();
  await local.close();
  console.log("Migration complete.");
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
