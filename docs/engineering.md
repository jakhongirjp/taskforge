# Engineering design

Architecture, data model, roles and API are in the [README](../README.md) and
the [ADRs](adr). This document covers the cross-cutting concerns.

## Boundaries

TaskForge is a modular monolith. The API is split into modules (`accounts`,
`members`, `work`, `audit`) that share a database but not tables: a module mostly
writes its own tables (registration is the exception: it creates the first membership), and cross-module needs go through functions, not joins in
route handlers. This keeps a later split into services possible without paying
for one now.

| Module | Owns | Exposes |
|---|---|---|
| accounts | `users`, `organizations` | register (creates the user, their organisation and owner membership in one transaction), login, `/me` |
| members | `memberships` | list, add, change role |
| work | `projects`, `tasks` | projects, tasks, board |
| audit | `audit_log` | `record()` inside a transaction, `GET /audit` |

## Authentication and authorisation

- **AuthN:** email and password, scrypt-hashed. The API issues an HS256 JWT
  (issuer and audience checked) with a 12-hour default lifetime. The web app
  keeps it in `sessionStorage`, so it is gone when the tab closes.
- **AuthZ:** every org route resolves `(user, org) → role` from `memberships`,
  then checks a permission from the matrix. The role is never taken from the token,
  so a demotion takes effect on the next request.
- **Planned:** refresh tokens in httpOnly cookies through a Next.js BFF route
  (M4), SSO via OIDC/SAML (M7), Postgres row-level security as a second layer (M4).

## Audit logging

`audit_log` rows carry `org_id`, actor, action (`task.updated`), target and a
JSON diff of changed fields. They are written in the same transaction as the
change, so the log can't miss an event or record one that rolled back. Owners
and admins read it through `GET /orgs/:orgId/audit`.

## Security design

| Threat | Mitigation |
|---|---|
| Cross-tenant access (IDOR) | `org_id` filter in every query; tests use another tenant's IDs and expect `404` |
| Privilege escalation | Only the owner grants or revokes admin; the owner's role can't be changed; matrix tested for monotonicity |
| Credential stuffing | 20 requests/minute per IP on auth routes; uniform timing |
| XSS | React escaping; Helmet security headers; token not in a cookie, so no CSRF surface |
| Token theft | Expiring tokens; planned move to httpOnly refresh cookie (M4) |
| Log leakage | Authorization header redacted in request logs |

## Performance and scaling

- Board queries hit `(org_id, project_id, status)`; assignee filters hit
  `(org_id, assignee_id)`.
- The API is stateless and scales horizontally; the only shared state is Postgres.
- The task counter row is a write hotspot per project. That's acceptable: it's
  one row per project, held for one statement.

## Observability

Structured JSON logs from Fastify (pino) with request IDs; `/healthz` and
`/readyz` (database ping). Planned (M5): Prometheus metrics and OpenTelemetry
traces across web and API.

## Disaster recovery

Postgres is the only stateful component. RPO 15 minutes and RTO 2 hours through
managed Postgres point-in-time recovery (see infra-blueprint). The API and web
images are rebuilt from Git.

## DevOps

- **CI:** lint, typecheck, API tests against a Postgres service container, web
  tests with Testing Library, production builds, Docker images.
- **CD:** the API is deployed by Argo CD from `infra-blueprint`
  (`k8s/argocd/apps/*/taskforge-api.yaml`).
- **Migrations:** Drizzle SQL migrations, forward-only and backwards compatible
  with the previous release.

## Testing strategy

| Layer | What | Where |
|---|---|---|
| Unit | Password hashing, tokens, RBAC matrix monotonicity | `apps/api/test/unit.test.ts` |
| API integration | Auth flows, tenant isolation, role checks, concurrent numbering, audit entries | `apps/api/test/*.test.ts` |
| Web | API client, board grouping, components | `apps/web/test` |
| Planned | Playwright end-to-end smoke test in CI (M3) | |

## Documentation strategy

README for orientation and setup, ADRs for decisions, this file for
cross-cutting concerns, `product.md` for the why. Shared contracts in
`packages/shared` are the API reference until the OpenAPI spec lands (M3).
