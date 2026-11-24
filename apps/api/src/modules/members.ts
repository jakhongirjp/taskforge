import { and, eq, sql } from "drizzle-orm";
import type { AddMemberInput, ChangeRoleInput, MemberDTO } from "@taskforge/shared";
import type { DB, Executor } from "../db/client.js";
import { memberships, users } from "../db/schema.js";
import type { TenantContext } from "../context.js";
import { assertCan } from "../rbac.js";
import { badRequest, conflict, forbidden, notFound } from "../errors.js";
import * as audit from "./audit.js";

export async function list(db: Executor, ctx: TenantContext): Promise<MemberDTO[]> {
  assertCan(ctx.role, "org:read");
  return db
    .select({ id: users.id, email: users.email, name: users.name, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, ctx.orgId))
    .orderBy(users.name);
}

/** Checks whether a user belongs to the organization (used to validate assignees). */
export async function isMember(db: Executor, orgId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  return Boolean(row);
}

export async function add(db: DB, ctx: TenantContext, input: AddMemberInput): Promise<MemberDTO> {
  assertCan(ctx.role, "members:manage");
  if (input.role === "admin") assertCan(ctx.role, "members:grant-admin");
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email}`);
    // Invitations by email for unregistered users are out of scope for this
    // service; the user must sign up first.
    if (!user) throw notFound("User");
    if (await isMember(tx, ctx.orgId, user.id)) throw conflict("User is already a member");
    await tx.insert(memberships).values({ orgId: ctx.orgId, userId: user.id, role: input.role });
    await audit.record(tx, ctx, {
      action: "member.added",
      entityType: "user",
      entityId: user.id,
      data: { role: input.role },
    });
    return { id: user.id, email: user.email, name: user.name, role: input.role };
  });
}

export async function changeRole(db: DB, ctx: TenantContext, userId: string, input: ChangeRoleInput) {
  assertCan(ctx.role, "members:manage");
  if (userId === ctx.userId) throw badRequest("You cannot change your own role");
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, userId)))
      .for("update");
    if (!target) throw notFound("Member");
    if (target.role === "owner") throw forbidden("The owner's role cannot be changed");
    // Admins may manage members and viewers but not other admins.
    if ((input.role === "admin" || target.role === "admin") && ctx.role !== "owner") {
      throw forbidden("Only the owner can grant or revoke admin");
    }
    await tx
      .update(memberships)
      .set({ role: input.role })
      .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, userId)));
    await audit.record(tx, ctx, {
      action: "member.role_changed",
      entityType: "user",
      entityId: userId,
      data: { from: target.role, to: input.role },
    });
    return { userId, role: input.role };
  });
}
