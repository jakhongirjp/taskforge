import { describe, expect, it, vi } from "vitest";
import { ApiError, createClient } from "@/lib/api";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("api client", () => {
  it("sends the bearer token and JSON body", async () => {
    const fetcher = vi.fn(async () => json(201, { id: "p1" }));
    const client = createClient(fetcher as unknown as typeof fetch, () => "tok");
    await client.createProject("org 1", { name: "Web", key: "WEB" });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/orgs/org%201/projects");
    expect(init.headers).toMatchObject({ authorization: "Bearer tok", "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ name: "Web", key: "WEB" });
  });

  it("raises ApiError with the problem body", async () => {
    const client = createClient((async () => json(403, { error: "forbidden", message: "nope" })) as typeof fetch, () => null);
    await expect(client.projects("o")).rejects.toEqual(expect.objectContaining({ status: 403, message: "nope" }));
    await expect(client.projects("o")).rejects.toBeInstanceOf(ApiError);
  });

  it("handles 204 responses", async () => {
    const client = createClient((async () => new Response(null, { status: 204 })) as typeof fetch, () => "t");
    await expect(client.deleteTask("o", "t")).resolves.toBeUndefined();
  });
});
