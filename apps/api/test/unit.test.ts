import { describe, expect, it } from "vitest";
import { ROLES } from "@taskforge/shared";
import { can, PERMISSIONS, type Permission } from "../src/rbac.js";
import { hashPassword, verifyPassword } from "../src/auth/password.js";
import { createTokenService } from "../src/auth/tokens.js";
import { slugify } from "../src/modules/accounts.js";

describe("rbac", () => {
  it("is monotonic: a higher role has every permission of a lower one", () => {
    const order = [...ROLES].reverse(); // viewer < member < admin < owner
    for (const perm of Object.keys(PERMISSIONS) as Permission[]) {
      for (let i = 0; i < order.length - 1; i++) {
        if (can(order[i]!, perm)) expect(can(order[i + 1]!, perm), `${order[i + 1]} should have ${perm}`).toBe(true);
      }
    }
  });

  it("matches the documented matrix", () => {
    expect(can("viewer", "task:write")).toBe(false);
    expect(can("member", "task:write")).toBe(true);
    expect(can("member", "task:delete")).toBe(false);
    expect(can("admin", "members:grant-admin")).toBe(false);
    expect(can("owner", "members:grant-admin")).toBe(true);
  });
});

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("s3cret-passphrase");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("s3cret-passphrase", hash)).toBe(true);
    expect(await verifyPassword("wrong-passphrase", hash)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toEqual(await hashPassword("same"));
  });
});

describe("tokens", () => {
  const svc = createTokenService("x".repeat(32), 60);

  it("round-trips the subject", async () => {
    expect(await svc.verify(await svc.sign("user-1"))).toEqual({ userId: "user-1" });
  });

  it("rejects tokens signed with another key", async () => {
    const other = createTokenService("y".repeat(32), 60);
    await expect(svc.verify(await other.sign("user-1"))).rejects.toMatchObject({ statusCode: 401 });
  });

  it("refuses short secrets", () => {
    expect(() => createTokenService("short", 60)).toThrow();
  });
});

describe("slugify", () => {
  it.each([
    ["Acme Inc", "acme-inc"],
    ["  Über   Labs!! ", "uber-labs"],
    ["***", "org"],
  ])("%s -> %s", (input, expected) => expect(slugify(input)).toBe(expected));
});
