import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { and, eq } from "drizzle-orm";
import { z, ZodError, type ZodType } from "zod";
import {
  AddMemberInput,
  ChangeRoleInput,
  CreateProjectInput,
  CreateTaskInput,
  LoginInput,
  RegisterInput,
  TaskFilter,
  UpdateTaskInput,
  type ProblemDTO,
} from "@taskforge/shared";
import type { DB } from "./db/client.js";
import { memberships } from "./db/schema.js";
import type { TokenService } from "./auth/tokens.js";
import type { TenantContext } from "./context.js";
import { AppError, notFound, unauthorized } from "./errors.js";
import * as accounts from "./modules/accounts.js";
import * as audit from "./modules/audit.js";
import * as members from "./modules/members.js";
import * as work from "./modules/work.js";

export interface AppDeps {
  db: DB;
  tokens: TokenService;
  corsOrigins: string[];
  logger?: boolean | object;
  /** Requests per minute per IP on auth routes. */
  authRateLimit?: number;
}

const parse = <T>(schema: ZodType<T>, value: unknown): T => schema.parse(value);
const IdParam = z.object({ orgId: z.uuid() });
const uuidParam = (name: string) => z.object({ orgId: z.uuid(), [name]: z.uuid() });

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    tenant?: TenantContext;
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const { db, tokens } = deps;
  const app = Fastify({
    logger: deps.logger ?? false,
    genReqId: () => crypto.randomUUID(),
    requestIdHeader: "x-request-id",
  });

  await app.register(helmet);
  await app.register(cors, { origin: deps.corsOrigins, credentials: false });
  await app.register(rateLimit, { global: false });

  app.setErrorHandler((err, req, reply) => {
    let status = 500;
    let body: ProblemDTO = { error: "internal", message: "Internal server error" };
    if (err instanceof ZodError) {
      status = 422;
      body = {
        error: "validation_failed",
        message: "Request validation failed",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      };
    } else if (err instanceof AppError) {
      status = err.statusCode;
      body = { error: err.code, message: err.message };
    } else if ((err as { code?: string }).code === "23505") {
      status = 409;
      body = { error: "conflict", message: "Resource already exists" };
    } else {
      // Fastify's own errors (malformed JSON, payload too large, rate limit).
      const e = err as { statusCode?: number; code?: string; message?: string };
      if (typeof e.statusCode === "number" && e.statusCode < 500) {
        status = e.statusCode;
        body = { error: e.code ?? "bad_request", message: e.message ?? "Bad request" };
      }
    }
    if (status >= 500) req.log.error({ err }, "unhandled error");
    void reply.status(status).send(body);
  });

  const authenticate = async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw unauthorized();
    req.userId = (await tokens.verify(header.slice(7))).userId;
  };

  /** Resolves the caller's membership; non-members get 404 so org IDs do not leak. */
  const resolveTenant = async (req: FastifyRequest) => {
    await authenticate(req);
    const { orgId } = parse(IdParam.loose(), req.params);
    const [m] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, req.userId!)));
    if (!m) throw notFound("Organization");
    req.tenant = { userId: req.userId!, orgId, role: m.role };
  };

  app.get("/healthz", async () => ({ status: "ok" }));
  app.get("/readyz", async (_req, reply) => {
    await db.execute("select 1");
    return reply.status(200).send({ status: "ready" });
  });

  const authLimit = { rateLimit: { max: deps.authRateLimit ?? 20, timeWindow: "1 minute" } };
  app.post("/auth/register", { config: authLimit }, async (req, reply) =>
    reply.status(201).send(await accounts.register(db, tokens, parse(RegisterInput, req.body))),
  );
  app.post("/auth/login", { config: authLimit }, async (req) =>
    accounts.login(db, tokens, parse(LoginInput, req.body)),
  );
  app.get("/me", { onRequest: authenticate }, async (req) => accounts.me(db, req.userId!));

  await app.register(
    async (org) => {
      org.addHook("onRequest", resolveTenant);

      org.get("/members", async (req) => ({ data: await members.list(db, req.tenant!) }));
      org.post("/members", async (req, reply) =>
        reply.status(201).send(await members.add(db, req.tenant!, parse(AddMemberInput, req.body))),
      );
      org.patch("/members/:userId", async (req) => {
        const { userId } = parse(uuidParam("userId"), req.params);
        return members.changeRole(db, req.tenant!, userId as string, parse(ChangeRoleInput, req.body));
      });

      org.get("/projects", async (req) => ({ data: await work.listProjects(db, req.tenant!) }));
      org.post("/projects", async (req, reply) =>
        reply.status(201).send(await work.createProject(db, req.tenant!, parse(CreateProjectInput, req.body))),
      );
      org.get("/projects/:projectId/tasks", async (req) => {
        const { projectId } = parse(uuidParam("projectId"), req.params);
        return { data: await work.listTasks(db, req.tenant!, projectId as string, parse(TaskFilter, req.query)) };
      });
      org.post("/projects/:projectId/tasks", async (req, reply) => {
        const { projectId } = parse(uuidParam("projectId"), req.params);
        const task = await work.createTask(db, req.tenant!, projectId as string, parse(CreateTaskInput, req.body));
        return reply.status(201).send(task);
      });
      org.patch("/tasks/:taskId", async (req) => {
        const { taskId } = parse(uuidParam("taskId"), req.params);
        return work.updateTask(db, req.tenant!, taskId as string, parse(UpdateTaskInput, req.body));
      });
      org.delete("/tasks/:taskId", async (req, reply) => {
        const { taskId } = parse(uuidParam("taskId"), req.params);
        await work.deleteTask(db, req.tenant!, taskId as string);
        return reply.status(204).send();
      });

      org.get("/audit", async (req) => {
        const q = parse(
          z.object({ before: z.coerce.number().int().positive().optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }),
          req.query,
        );
        return { data: await audit.list(db, req.tenant!, q) };
      });
    },
    { prefix: "/orgs/:orgId" },
  );

  return app;
}
