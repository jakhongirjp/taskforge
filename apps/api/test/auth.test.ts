import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { setupApp, signUp, uniqueEmail } from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  app = await setupApp();
});

describe("auth", () => {
  it("registers a user with an owned organization", async () => {
    const { user, organizations, token } = await signUp(app, { org: "Rocket Labs" });
    expect(token).toBeTypeOf("string");
    expect(user.email).toMatch(/@example.com$/);
    expect(organizations).toEqual([expect.objectContaining({ name: "Rocket Labs", role: "owner" })]);
    expect(organizations[0]!.slug).toMatch(/^rocket-labs-[0-9a-f]{6}$/);
  });

  it("normalizes email case and rejects duplicates", async () => {
    const email = uniqueEmail("Case");
    await signUp(app, { email });
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: email.toUpperCase(), password: "another long password", name: "x", organizationName: "Dup" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("logs in and returns memberships", async () => {
    const email = uniqueEmail();
    await signUp(app, { email });
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: email.toUpperCase(), password: "correct horse battery staple" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().organizations).toHaveLength(1);
  });

  it("gives the same error for a wrong password and an unknown email", async () => {
    const email = uniqueEmail();
    await signUp(app, { email });
    const wrong = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "nope" } });
    const unknown = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: uniqueEmail("ghost"), password: "nope" },
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
  });

  it("validates input with field-level issues", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "not-an-email", password: "short", name: "", organizationName: "A" },
    });
    expect(res.statusCode).toBe(422);
    const paths = res.json().issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(["email", "password", "name", "organizationName"]));
  });

  it("protects /me", async () => {
    expect((await app.inject({ method: "GET", url: "/me" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/me", headers: { authorization: "Bearer junk" } })).statusCode).toBe(401);
    const { auth } = await signUp(app);
    const me = await app.inject({ method: "GET", url: "/me", headers: auth });
    expect(me.statusCode).toBe(200);
  });

  it("serves health endpoints and security headers", async () => {
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});
