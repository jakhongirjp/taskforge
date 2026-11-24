# CTO review checklist

Where the project stands. Unchecked items have an issue.

## Architecture
- [x] Modular monolith with module-owned tables
- [x] Shared request/response contracts between web and API
- [x] Decisions recorded as ADRs
- [ ] OpenAPI specification published (M3)

## Multi-tenancy and access
- [x] Every query scoped by `org_id`
- [x] Cross-tenant IDs indistinguishable from missing ones
- [x] RBAC matrix as data, tested for monotonicity
- [ ] Database-level isolation (RLS) as defence in depth (M4)
- [ ] SSO for enterprise customers (M7)

## Security
- [x] scrypt hashing, constant-time compare, uniform timing
- [x] Rate-limited auth routes, Helmet headers, CORS allow-list
- [x] Authorization header redacted from logs
- [ ] Refresh-token rotation and server-side revocation (M4)
- [ ] Dependency and container image scanning in CI

## Data
- [x] Audit log written in the same transaction as the change
- [x] Gap-free task numbering under concurrency, tested
- [x] Forward-only migrations
- [ ] Data export per organisation (customer offboarding)

## Operations
- [x] Health and readiness endpoints, request IDs
- [x] Containerised API and web, GitOps deployment in infra-blueprint
- [ ] Metrics and tracing (M5)
- [ ] Load test for board reads (M6)

## Delivery
- [x] CI: lint, typecheck, API and web tests, builds
- [x] PR template, issue forms, CODEOWNERS, Dependabot
- [ ] End-to-end browser test in CI (M3)
