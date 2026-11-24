# TaskForge

[![CI](https://github.com/jakhongirjp/taskforge/actions/workflows/ci.yml/badge.svg)](https://github.com/jakhongirjp/taskforge/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![License](https://img.shields.io/badge/license-MIT-blue)

A multi-tenant project management SaaS: organizations, role-based access,
projects with human-readable task refs (`WEB-42`), a kanban board and a full
audit trail. Built as a TypeScript monorepo with one set of contracts shared
by the API and the web app.

## What it shows

- **Tenant isolation by construction.** Every org-scoped route resolves the
  caller's membership first, and every query filters on `org_id`. IDs from
  another tenant behave exactly like missing IDs (`404`), so nothing about
  other organizations leaks. Tests attack this from both directions.
- **RBAC as data.** One permission matrix (`apps/api/src/rbac.ts`) drives all
  checks and is tested for monotonicity: a higher role always has every
  permission of a lower one.
- **Shared contracts.** `packages/shared` holds Zod schemas and DTO types. The
  API validates requests with them and the web app compiles against them, so a
  payload change breaks the build on both sides instead of in production.
- **Concurrency-safe numbering.** Task refs come from an atomic
  `UPDATE … SET task_counter = task_counter + 1 RETURNING`; a test fires 15
  concurrent creates and expects `WEB-1…WEB-15` with no gaps or duplicates.
- **Security basics done right.** scrypt password hashing with a
  self-describing format, constant-time comparison and equal timing for
  unknown emails; expiring JWTs (12 h default, configurable) with issuer/audience checks; Helmet headers;
  rate-limited auth routes; authorization headers redacted from logs.
- **Audit log in the same transaction** as each change, recording who did what
  and a field-level diff.

## Architecture

```mermaid
flowchart LR
    subgraph web [apps/web · Next.js 16]
      ui[App Router pages] --> client[typed API client]
    end
    subgraph api [apps/api · Fastify 5]
      routes[routes + Zod validation] --> guard[auth + tenant guard]
      guard --> rbac[RBAC matrix]
      rbac --> modules[accounts · members · work · audit]
      modules --> drizzle[Drizzle ORM]
    end
    shared[[packages/shared<br/>Zod schemas + DTOs]]
    client -->|Bearer JWT| routes
    shared -.-> client
    shared -.-> routes
    drizzle --> pg[(PostgreSQL 16)]
```

### Data model

```mermaid
erDiagram
    users ||--o{ memberships : has
    organizations ||--o{ memberships : has
    organizations ||--o{ projects : owns
    projects ||--o{ tasks : contains
    users ||--o{ tasks : "assigned / created"
    organizations ||--o{ audit_log : records
    memberships { uuid org_id PK; uuid user_id PK; role role }
    projects { uuid id PK; uuid org_id FK; text key "unique per org"; int task_counter }
    tasks { uuid id PK; uuid org_id FK; int number "unique per project"; task_status status; task_priority priority }
```

### Roles

| Permission | owner | admin | member | viewer |
|---|:-:|:-:|:-:|:-:|
| Read projects, tasks, members | ✓ | ✓ | ✓ | ✓ |
| Create and update tasks | ✓ | ✓ | ✓ | |
| Create projects, delete tasks, read audit log | ✓ | ✓ | | |
| Add members, change member/viewer roles | ✓ | ✓ | | |
| Grant or revoke admin | ✓ | | | |

## Getting started

```bash
docker compose up --build        # postgres + api (:4000) + web (:3000)
open http://localhost:3000/register
```

Local development:

```bash
npm install
docker compose up -d postgres
DATABASE_URL=postgres://taskforge:taskforge@localhost:5432/taskforge \
JWT_SECRET=dev-secret-that-is-at-least-32-chars npm run dev:api
npm run dev:web
```

## API

All org routes are under `/orgs/:orgId` and need `Authorization: Bearer <token>`.

| Method | Path | Role |
|---|---|---|
| `POST` | `/auth/register`, `/auth/login` | public (rate limited) |
| `GET` | `/me` | any signed-in user |
| `GET` / `POST` | `/members` | read: any · add: admin+ |
| `PATCH` | `/members/:userId` | admin+ (admin grants: owner) |
| `GET` / `POST` | `/projects` | read: any · create: admin+ |
| `GET` / `POST` | `/projects/:projectId/tasks?status=&assigneeId=` | read: any · create: member+ |
| `PATCH` / `DELETE` | `/tasks/:taskId` | update: member+ · delete: admin+ |
| `GET` | `/audit?before=&limit=` | admin+ |

Errors are JSON `{ error, message, issues? }`; validation failures return `422`
with field paths.

## Testing

```bash
npm run lint && npm run typecheck
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm test
```

- **API (Vitest + real PostgreSQL):** a global setup creates a throwaway
  database, runs the Drizzle migrations and drops it afterwards. Tests cover
  auth, validation, RBAC over HTTP, tenant isolation and concurrency.
- **Web (Vitest + Testing Library + jsdom):** board logic, components and the
  API client with an injected `fetch`.

CI runs lint, typecheck, both test suites against a Postgres service, the
production builds and both Docker images.

## Repository layout

```
apps/api        Fastify API, Drizzle schema + SQL migrations, tests
apps/web        Next.js App Router UI, Tailwind CSS v4
packages/shared Zod schemas and DTO types used by both apps
docs/adr        architecture decision records
```

## Decisions

- [ADR-0001: Shared-schema multi-tenancy with app-level scoping](docs/adr/0001-multi-tenancy.md)
- [ADR-0002: Fastify + Drizzle instead of a heavier framework and ORM](docs/adr/0002-fastify-drizzle.md)

## Roadmap

- PostgreSQL row-level security as a second isolation layer
- Email invitations for people without an account
- Refresh tokens in httpOnly cookies via a Next.js BFF route
- Drag-and-drop board and real-time updates over WebSockets

## Documentation

| Document | Contents |
|---|---|
| [Product](docs/product.md) | Vision, business problem, business and technical requirements, workflows |
| [Engineering](docs/engineering.md) | Boundaries, security, performance, observability, DR, DevOps, testing |
| [Roadmap](docs/roadmap.md) | Ten milestones and the release plan |
| [CTO review checklist](docs/cto-review-checklist.md) | Honest status against production-readiness criteria |
| [ADRs](docs/adr) | Architecture decisions |
| [Contributing](CONTRIBUTING.md) | Branching, commits, labels, board, releases |

## License

MIT
