/** Projects and tasks: the core work-tracking domain. */
import { and, asc, eq, sql } from "drizzle-orm";
import type {
  CreateProjectInput,
  CreateTaskInput,
  ProjectDTO,
  TaskDTO,
  TaskFilter,
  UpdateTaskInput,
} from "@taskforge/shared";
import type { DB, Executor } from "../db/client.js";
import { projects, tasks } from "../db/schema.js";
import type { TenantContext } from "../context.js";
import { assertCan } from "../rbac.js";
import { badRequest, conflict, notFound } from "../errors.js";
import * as audit from "./audit.js";
import { isMember } from "./members.js";

const toProject = (p: typeof projects.$inferSelect): ProjectDTO => ({
  id: p.id,
  key: p.key,
  name: p.name,
  description: p.description,
  createdAt: p.createdAt.toISOString(),
});

const toTask = (t: typeof tasks.$inferSelect, key: string): TaskDTO => ({
  id: t.id,
  projectId: t.projectId,
  ref: `${key}-${t.number}`,
  title: t.title,
  description: t.description,
  status: t.status,
  priority: t.priority,
  assigneeId: t.assigneeId,
  createdBy: t.createdBy,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});

export async function listProjects(db: Executor, ctx: TenantContext): Promise<ProjectDTO[]> {
  assertCan(ctx.role, "org:read");
  const rows = await db.select().from(projects).where(eq(projects.orgId, ctx.orgId)).orderBy(asc(projects.name));
  return rows.map(toProject);
}

export async function createProject(db: DB, ctx: TenantContext, input: CreateProjectInput): Promise<ProjectDTO> {
  assertCan(ctx.role, "project:create");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(projects)
      .values({ orgId: ctx.orgId, ...input })
      .onConflictDoNothing()
      .returning();
    if (!row) throw conflict(`A project with key ${input.key} already exists`);
    await audit.record(tx, ctx, { action: "project.created", entityType: "project", entityId: row.id });
    return toProject(row);
  });
}

/** Every lookup is scoped by org_id, so IDs from another tenant behave as missing. */
async function getProject(db: Executor, ctx: TenantContext, projectId: string) {
  const [p] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.orgId, ctx.orgId)));
  if (!p) throw notFound("Project");
  return p;
}

async function assertAssignable(db: Executor, ctx: TenantContext, assigneeId: string | null | undefined) {
  if (assigneeId && !(await isMember(db, ctx.orgId, assigneeId))) {
    throw badRequest("Assignee must be a member of this organization");
  }
}

export async function listTasks(db: Executor, ctx: TenantContext, projectId: string, filter: TaskFilter) {
  assertCan(ctx.role, "org:read");
  const project = await getProject(db, ctx, projectId);
  const rows = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.orgId, ctx.orgId),
        eq(tasks.projectId, project.id),
        filter.status ? eq(tasks.status, filter.status) : undefined,
        filter.assigneeId ? eq(tasks.assigneeId, filter.assigneeId) : undefined,
      ),
    )
    .orderBy(asc(tasks.number));
  return rows.map((t) => toTask(t, project.key));
}

export async function createTask(db: DB, ctx: TenantContext, projectId: string, input: CreateTaskInput) {
  assertCan(ctx.role, "task:write");
  return db.transaction(async (tx) => {
    // Atomically reserve the next number; the row lock serializes concurrent creators.
    const [project] = await tx
      .update(projects)
      .set({ taskCounter: sql`${projects.taskCounter} + 1` })
      .where(and(eq(projects.id, projectId), eq(projects.orgId, ctx.orgId)))
      .returning();
    if (!project) throw notFound("Project");
    await assertAssignable(tx, ctx, input.assigneeId);
    const [task] = await tx
      .insert(tasks)
      .values({ orgId: ctx.orgId, projectId, number: project.taskCounter, createdBy: ctx.userId, ...input })
      .returning();
    const dto = toTask(task!, project.key);
    await audit.record(tx, ctx, { action: "task.created", entityType: "task", entityId: dto.id, data: { ref: dto.ref } });
    return dto;
  });
}

async function getTaskForUpdate(db: Executor, ctx: TenantContext, taskId: string) {
  const [row] = await db
    .select({ task: tasks, key: projects.key })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(and(eq(tasks.id, taskId), eq(tasks.orgId, ctx.orgId)))
    .for("update", { of: tasks });
  if (!row) throw notFound("Task");
  return row;
}

export async function updateTask(db: DB, ctx: TenantContext, taskId: string, input: UpdateTaskInput) {
  assertCan(ctx.role, "task:write");
  return db.transaction(async (tx) => {
    const { task, key } = await getTaskForUpdate(tx, ctx, taskId);
    await assertAssignable(tx, ctx, input.assigneeId);
    const [updated] = await tx
      .update(tasks)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(tasks.id, task.id))
      .returning();
    const changes = Object.fromEntries(
      Object.keys(input).map((k) => [k, { from: task[k as keyof typeof task], to: input[k as keyof typeof input] }]),
    );
    await audit.record(tx, ctx, { action: "task.updated", entityType: "task", entityId: task.id, data: changes });
    return toTask(updated!, key);
  });
}

export async function deleteTask(db: DB, ctx: TenantContext, taskId: string) {
  assertCan(ctx.role, "task:delete");
  await db.transaction(async (tx) => {
    const { task, key } = await getTaskForUpdate(tx, ctx, taskId);
    await tx.delete(tasks).where(eq(tasks.id, task.id));
    await audit.record(tx, ctx, {
      action: "task.deleted",
      entityType: "task",
      entityId: task.id,
      data: { ref: `${key}-${task.number}`, title: task.title },
    });
  });
}
