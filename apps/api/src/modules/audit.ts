import { and, desc, eq, lt } from "drizzle-orm";
import type { Executor } from "../db/client.js";
import { auditLog } from "../db/schema.js";
import type { TenantContext } from "../context.js";
import { assertCan } from "../rbac.js";

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  data?: Record<string, unknown>;
}

/** Records an audit event. Call inside the same transaction as the change. */
export async function record(db: Executor, ctx: Pick<TenantContext, "orgId" | "userId">, entry: AuditEntry) {
  await db.insert(auditLog).values({
    orgId: ctx.orgId,
    actorId: ctx.userId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    data: entry.data ?? {},
  });
}

export async function list(db: Executor, ctx: TenantContext, opts: { before?: number; limit: number }) {
  assertCan(ctx.role, "audit:read");
  const rows = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.orgId, ctx.orgId), opts.before ? lt(auditLog.id, opts.before) : undefined))
    .orderBy(desc(auditLog.id))
    .limit(opts.limit);
  return rows.map((r) => ({
    id: r.id,
    actorId: r.actorId,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    data: r.data,
    createdAt: r.createdAt.toISOString(),
  }));
}
