import { afterAll, inject } from "vitest";
import type { FastifyInstance } from "fastify";
import type { AuthResponse } from "@taskforge/shared";
import { buildApp } from "../src/app.js";
import { createDb } from "../src/db/client.js";
import { createTokenService } from "../src/auth/tokens.js";

export async function setupApp(): Promise<FastifyInstance> {
  const { db, pool } = createDb(inject("databaseUrl"), 5);
  const app = await buildApp({
    db,
    tokens: createTokenService("test-secret-test-secret-test-secret!", 3600),
    corsOrigins: ["http://localhost:3000"],
    authRateLimit: 1000,
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });
  return app;
}

let counter = 0;
export const uniqueEmail = (prefix = "user") => `${prefix}.${Date.now()}.${++counter}@example.com`;

export async function signUp(app: FastifyInstance, overrides: Partial<{ email: string; name: string; org: string }> = {}) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: {
      email: overrides.email ?? uniqueEmail(),
      password: "correct horse battery staple",
      name: overrides.name ?? "Test User",
      organizationName: overrides.org ?? "Acme Inc",
    },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  const body = res.json<AuthResponse>();
  return { ...body, orgId: body.organizations[0]!.id, auth: { authorization: `Bearer ${body.token}` } };
}
