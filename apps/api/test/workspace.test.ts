import { beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { TaskDTO } from "@taskforge/shared";
import { setupApp, signUp } from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  app = await setupApp();
});

type Session = Awaited<ReturnType<typeof signUp>>;

const call = (s: Session, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url: `/orgs/${s.orgId}${url}`, headers: s.auth, ...(payload ? { payload } : {}) });

async function addMember(owner: Session, role: "admin" | "member" | "viewer") {
  const other = await signUp(app, { name: role });
  const res = await call(owner, "POST", "/members", { email: other.user.email, role });
  expect(res.statusCode).toBe(201);
  // Act as the new member inside the owner's organization.
  return { ...other, orgId: owner.orgId };
}

async function project(s: Session, key = "WEB") {
  const res = await call(s, "POST", "/projects", { name: "Website", key });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string; key: string }>();
}

describe("projects and tasks", () => {
  it("mints sequential human-readable refs under concurrency", async () => {
    const owner = await signUp(app);
    const p = await project(owner);
    const results = await Promise.all(
      Array.from({ length: 15 }, (_, i) => call(owner, "POST", `/projects/${p.id}/tasks`, { title: `Task ${i}` })),
    );
    expect(results.every((r) => r.statusCode === 201)).toBe(true);
    const refs = results.map((r) => r.json<TaskDTO>().ref).sort((a, b) => Number(a.split("-")[1]) - Number(b.split("-")[1]));
    expect(refs).toEqual(Array.from({ length: 15 }, (_, i) => `WEB-${i + 1}`));
  });

  it("filters, updates and audits tasks", async () => {
    const owner = await signUp(app);
    const member = await addMember(owner, "member");
    const p = await project(owner, "OPS");
    const created = (await call(owner, "POST", `/projects/${p.id}/tasks`, { title: "Rotate keys", priority: "high" })).json<TaskDTO>();
    await call(owner, "POST", `/projects/${p.id}/tasks`, { title: "Other" });

    const upd = await call(member, "PATCH", `/tasks/${created.id}`, { status: "in_progress", assigneeId: member.user.id });
    expect(upd.statusCode).toBe(200);
    expect(upd.json()).toMatchObject({ status: "in_progress", assigneeId: member.user.id, ref: "OPS-1" });

    const filtered = await call(owner, "GET", `/projects/${p.id}/tasks?status=in_progress`);
    expect(filtered.json().data.map((t: TaskDTO) => t.ref)).toEqual(["OPS-1"]);

    const log = (await call(owner, "GET", "/audit?limit=10")).json().data;
    expect(log[0]).toMatchObject({
      action: "task.updated",
      actorId: member.user.id,
      data: { status: { from: "todo", to: "in_progress" } },
    });
  });

  it("rejects assignees outside the organization", async () => {
    const owner = await signUp(app);
    const stranger = await signUp(app);
    const p = await project(owner);
    const res = await call(owner, "POST", `/projects/${p.id}/tasks`, { title: "x", assigneeId: stranger.user.id });
    expect(res.statusCode).toBe(400);
  });

  it("rejects duplicate project keys within an org but allows them across orgs", async () => {
    const a = await signUp(app);
    const b = await signUp(app);
    await project(a, "DUP");
    expect((await call(a, "POST", "/projects", { name: "Again", key: "dup" })).statusCode).toBe(409);
    expect((await call(b, "POST", "/projects", { name: "Mine", key: "DUP" })).statusCode).toBe(201);
  });
});

describe("role-based access control", () => {
  it("enforces the permission matrix over HTTP", async () => {
    const owner = await signUp(app);
    const admin = await addMember(owner, "admin");
    const member = await addMember(owner, "member");
    const viewer = await addMember(owner, "viewer");
    const p = await project(owner);
    const task = (await call(owner, "POST", `/projects/${p.id}/tasks`, { title: "t" })).json<TaskDTO>();

    // viewers can read but not write
    expect((await call(viewer, "GET", `/projects/${p.id}/tasks`)).statusCode).toBe(200);
    expect((await call(viewer, "POST", `/projects/${p.id}/tasks`, { title: "no" })).statusCode).toBe(403);
    // members write tasks but cannot create projects, delete or read audit
    expect((await call(member, "POST", "/projects", { name: "x", key: "XX" })).statusCode).toBe(403);
    expect((await call(member, "DELETE", `/tasks/${task.id}`)).statusCode).toBe(403);
    expect((await call(member, "GET", "/audit")).statusCode).toBe(403);
    // admins cannot mint other admins; owners can
    const extra = await signUp(app);
    expect((await call(admin, "POST", "/members", { email: extra.user.email, role: "admin" })).statusCode).toBe(403);
    expect((await call(owner, "PATCH", `/members/${member.user.id}`, { role: "admin" })).statusCode).toBe(200);
    // nobody can demote the owner, and you cannot change your own role
    expect((await call(admin, "PATCH", `/members/${owner.user.id}`, { role: "viewer" })).statusCode).toBe(403);
    expect((await call(owner, "PATCH", `/members/${owner.user.id}`, { role: "viewer" })).statusCode).toBe(400);
    // admins delete tasks
    expect((await call(admin, "DELETE", `/tasks/${task.id}`)).statusCode).toBe(204);
  });
});

describe("tenant isolation", () => {
  it("hides other organizations' data behind 404s", async () => {
    const alice = await signUp(app, { org: "Alice Co" });
    const mallory = await signUp(app, { org: "Mallory Co" });
    const p = await project(alice, "SEC");
    const task = (await call(alice, "POST", `/projects/${p.id}/tasks`, { title: "secret" })).json<TaskDTO>();

    // Mallory addresses Alice's org directly.
    const asMallory = { ...mallory, orgId: alice.orgId };
    expect((await call(asMallory, "GET", "/projects")).statusCode).toBe(404);

    // Mallory uses Alice's IDs inside her own org.
    expect((await call(mallory, "GET", `/projects/${p.id}/tasks`)).statusCode).toBe(404);
    expect((await call(mallory, "PATCH", `/tasks/${task.id}`, { title: "pwned" })).statusCode).toBe(404);
    expect((await call(mallory, "DELETE", `/tasks/${task.id}`)).statusCode).toBe(404);

    const still = (await call(alice, "GET", `/projects/${p.id}/tasks`)).json().data;
    expect(still[0]).toMatchObject({ title: "secret" });
  });

  it("validates route params", async () => {
    const s = await signUp(app);
    const res = await app.inject({ method: "GET", url: "/orgs/not-a-uuid/projects", headers: s.auth });
    expect(res.statusCode).toBe(422);
  });
});
