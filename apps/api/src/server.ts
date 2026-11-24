import { z } from "zod";
import { buildApp } from "./app.js";
import { createDb, runMigrations } from "./db/client.js";
import { createTokenService } from "./auth/tokens.js";

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 12),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default("0.0.0.0"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  MIGRATE_ON_START: z.stringbool().default(true),
});

async function main() {
  const env = Env.parse(process.env);
  const { db, pool } = createDb(env.DATABASE_URL);
  if (env.MIGRATE_ON_START) await runMigrations(db);

  const app = await buildApp({
    db,
    tokens: createTokenService(env.JWT_SECRET, env.JWT_TTL_SECONDS),
    corsOrigins: env.CORS_ORIGINS.split(",").map((s) => s.trim()),
    logger: { level: env.LOG_LEVEL, redact: ["req.headers.authorization"] },
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
