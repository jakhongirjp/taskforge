import { eq, sql } from "drizzle-orm";
import type { AuthResponse, LoginInput, OrganizationDTO, RegisterInput, UserDTO } from "@taskforge/shared";
import type { DB } from "../db/client.js";
import { memberships, organizations, users } from "../db/schema.js";
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from "../auth/password.js";
import type { TokenService } from "../auth/tokens.js";
import { conflict, unauthorized } from "../errors.js";
import * as audit from "./audit.js";

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 40);
  return base || "org";
}

const toUser = (u: typeof users.$inferSelect): UserDTO => ({ id: u.id, email: u.email, name: u.name });

export async function organizationsFor(db: DB, userId: string): Promise<OrganizationDTO[]> {
  const rows = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, userId))
    .orderBy(organizations.name);
  return rows;
}

/** Creates a user, their first organization and an owner membership atomically. */
export async function register(db: DB, tokens: TokenService, input: RegisterInput): Promise<AuthResponse> {
  const passwordHash = await hashPassword(input.password);
  const { user, org } = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email}`);
    if (existing) throw conflict("An account with this email already exists");

    const [user] = await tx.insert(users).values({ email: input.email, name: input.name, passwordHash }).returning();
    // Slugs are unique; append a short random suffix on collision.
    const slug = `${slugify(input.organizationName)}-${crypto.randomUUID().slice(0, 6)}`;
    const [org] = await tx.insert(organizations).values({ name: input.organizationName, slug }).returning();
    await tx.insert(memberships).values({ orgId: org!.id, userId: user!.id, role: "owner" });
    await audit.record(tx, { orgId: org!.id, userId: user!.id }, {
      action: "organization.created",
      entityType: "organization",
      entityId: org!.id,
    });
    return { user: user!, org: org! };
  });
  return {
    token: await tokens.sign(user.id),
    user: toUser(user),
    organizations: [{ id: org.id, name: org.name, slug: org.slug, role: "owner" }],
  };
}

export async function login(db: DB, tokens: TokenService, input: LoginInput): Promise<AuthResponse> {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`);
  // Always run scrypt so response time does not reveal whether the email exists.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await DUMMY_HASH_PROMISE));
  if (!user || !ok) throw unauthorized("Invalid email or password");
  return { token: await tokens.sign(user.id), user: toUser(user), organizations: await organizationsFor(db, user.id) };
}

export async function me(db: DB, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw unauthorized();
  return { user: toUser(user), organizations: await organizationsFor(db, userId) };
}
