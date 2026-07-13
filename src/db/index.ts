import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { bootstrap } from "./bootstrap";

// Both drivers are structurally compatible for our query usage; we normalize
// to the PGlite-typed interface so app code sees a single Db type.
export type Db = PgliteDatabase<typeof schema>;

type GlobalWithDb = typeof globalThis & {
  __udsDb?: Promise<Db>;
};

async function createDb(): Promise<Db> {
  let db: Db;
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import("postgres");
    const client = postgres(process.env.DATABASE_URL, { max: 5, prepare: false });
    db = drizzlePostgres(client, { schema }) as unknown as Db;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const dataDir = path.join(process.cwd(), ".data", "pg");
    fs.mkdirSync(dataDir, { recursive: true });
    const client = new PGlite(dataDir);
    db = drizzlePglite(client, { schema });
  }
  await bootstrap(db);
  return db;
}

export function getDb(): Promise<Db> {
  const g = globalThis as GlobalWithDb;
  if (!g.__udsDb) {
    g.__udsDb = createDb();
    // Don't cache a failed init — let the next request retry.
    g.__udsDb.catch(() => {
      g.__udsDb = undefined;
    });
  }
  return g.__udsDb;
}

export * from "./schema";
