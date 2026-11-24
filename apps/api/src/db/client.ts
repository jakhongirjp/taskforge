import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import * as schema from "./schema.js";

export type DB = NodePgDatabase<typeof schema>;
/** A database handle or an open transaction; repositories accept either. */
export type Executor = Parameters<Parameters<DB["transaction"]>[0]>[0] | DB;

export function createDb(databaseUrl: string, max = 10): { db: DB; pool: pg.Pool } {
  const pool = new pg.Pool({ connectionString: databaseUrl, max });
  return { db: drizzle(pool, { schema }), pool };
}

/** Locates the SQL migrations both from src (tsx) and from the bundled dist. */
export function migrationsFolder(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [path.resolve(here, "../../drizzle"), path.resolve(here, "../drizzle")];
  const found = process.env.MIGRATIONS_DIR ?? candidates.find((p) => existsSync(path.join(p, "meta")));
  if (!found) throw new Error(`migrations folder not found (looked in ${candidates.join(", ")})`);
  return found;
}

export async function runMigrations(db: DB, folder = migrationsFolder()): Promise<void> {
  await migrate(db, { migrationsFolder: folder });
}
