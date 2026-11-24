import pg from "pg";
import type { TestProject } from "vitest/node";
import { createDb, runMigrations } from "../src/db/client.js";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Creates one throwaway database for the run, migrates it, drops it after. */
export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
  const name = `taskforge_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const { db, pool } = createDb(url.toString(), 2);
  await runMigrations(db);
  await pool.end();
  project.provide("databaseUrl", url.toString());

  return async () => {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  };
}
