/**
 * Removes the data generated while trying the system out — staff requests,
 * calendar assignments, attendance (arrivals / lateness), score adjustments and
 * team notices — from a chosen date onwards.
 *
 * Work orders are never touched. Neither are customers, parts, job status
 * history, staff accounts or settings.
 *
 *   node scripts/clean-test-data.mjs                  # dry run, since yesterday
 *   node scripts/clean-test-data.mjs --since=2026-09-06
 *   node scripts/clean-test-data.mjs --since=2026-09-06 --yes
 *   node scripts/clean-test-data.mjs --since=2026-09-06 --yes --include-activity
 *
 * The URL comes from DATABASE_URL or the first bare argument.
 */

/** Tables this script may delete from, in foreign-key-safe order. */
export const CLEANUP_STEPS = [
  {
    key: "attendance",
    label: "Attendance (arrivals and lateness)",
    count: `SELECT count(*)::int AS n FROM attendance WHERE work_date >= $1`,
    remove: `DELETE FROM attendance WHERE work_date >= $1`,
  },
  {
    key: "assignments",
    label: "Calendar assignments",
    count: `SELECT count(*)::int AS n FROM assignments WHERE created_at >= $1::date`,
    remove: `DELETE FROM assignments WHERE created_at >= $1::date`,
  },
  {
    key: "performance_events",
    label: "Score adjustments and flagged mistakes",
    count: `SELECT count(*)::int AS n FROM performance_events WHERE created_at >= $1::date`,
    remove: `DELETE FROM performance_events WHERE created_at >= $1::date`,
  },
  {
    key: "requests",
    label: "Staff requests (messages go with them)",
    count: `SELECT count(*)::int AS n FROM requests WHERE created_at >= $1::date`,
    remove: `DELETE FROM requests WHERE created_at >= $1::date`,
  },
  {
    key: "announcements",
    label: "Team notices (read receipts go with them)",
    count: `SELECT count(*)::int AS n FROM announcements WHERE created_at >= $1::date`,
    remove: `DELETE FROM announcements WHERE created_at >= $1::date`,
  },
];

/**
 * Opt-in. Audit rows about work orders are always kept, so the history of every
 * check-in stays complete.
 */
export const ACTIVITY_STEP = {
  key: "activity_log",
  label: "Activity log (staff entries only — work-order history is kept)",
  count: `SELECT count(*)::int AS n FROM activity_log WHERE created_at >= $1::date AND entity <> 'entry'`,
  remove: `DELETE FROM activity_log WHERE created_at >= $1::date AND entity <> 'entry'`,
};

/** Proof that the work orders survived. */
export const KEEP_CHECKS = [
  { label: "Work orders", sql: `SELECT count(*)::int AS n FROM entries` },
  { label: "Customers", sql: `SELECT count(*)::int AS n FROM customers` },
  { label: "Parts lines", sql: `SELECT count(*)::int AS n FROM parts` },
  { label: "Job status history", sql: `SELECT count(*)::int AS n FROM status_history` },
  { label: "Staff accounts", sql: `SELECT count(*)::int AS n FROM users` },
];

export function yesterdayInShopTime(timeZone = "America/New_York") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = { since: "", apply: false, includeActivity: false, url: "" };
  for (const a of argv) {
    if (a.startsWith("--since=")) args.since = a.slice(8);
    else if (a === "--yes" || a === "--apply") args.apply = true;
    else if (a === "--include-activity") args.includeActivity = true;
    else if (!a.startsWith("--")) args.url = a;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url || process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL, or pass the Postgres URL as an argument.");
    process.exit(1);
  }
  const since = args.since || yesterdayInShopTime();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    console.error(`--since must look like YYYY-MM-DD (got "${since}").`);
    process.exit(1);
  }

  const { default: postgres } = await import("postgres");
  const sql = postgres(url.replace(/[?&]channel_binding=[^&]*/i, ""), { max: 1, prepare: false });

  const steps = args.includeActivity ? [...CLEANUP_STEPS, ACTIVITY_STEP] : CLEANUP_STEPS;

  try {
    console.log(`\nCleaning test data created on or after ${since}`);
    console.log(args.apply ? "Mode: DELETING\n" : "Mode: dry run — nothing is deleted. Add --yes to apply.\n");

    let total = 0;
    const planned = [];
    for (const step of steps) {
      const [row] = await sql.unsafe(step.count, [since]);
      planned.push([step, row.n]);
      total += row.n;
      console.log(`  ${String(row.n).padStart(5)}  ${step.label}`);
    }

    if (total === 0) {
      console.log("\nNothing to clean.");
      return;
    }

    if (!args.apply) {
      console.log(`\n${total} rows would be removed. Re-run with --yes to do it.`);
      return;
    }

    // One transaction: either the whole cleanup lands or none of it does.
    await sql.begin(async (tx) => {
      for (const [step] of planned) await tx.unsafe(step.remove, [since]);
    });
    console.log(`\nRemoved ${total} rows.`);

    console.log("\nUntouched:");
    for (const check of KEEP_CHECKS) {
      const [row] = await sql.unsafe(check.sql);
      console.log(`  ${String(row.n).padStart(5)}  ${check.label}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Only run when invoked directly, so the statements above stay testable.
if (process.argv[1] && process.argv[1].endsWith("clean-test-data.mjs")) {
  main().catch((err) => {
    console.error("\nFailed:", err.message);
    process.exit(1);
  });
}
