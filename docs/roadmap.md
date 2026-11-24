# Roadmap

Milestones are outcomes. Open work for each is tracked as
[GitHub issues](https://github.com/jakhongirjp/taskforge/issues) under the matching milestone.

| # | Milestone | Outcome | Status |
|---|---|---|---|
| M1 | Tenancy and auth | Register, login, organisations, memberships, roles | Done (v0.1) |
| M2 | Projects and board | Projects, tasks with refs, board UI, audit log | Done (v0.1) |
| M3 | API contract | OpenAPI generated from the Zod schemas, Playwright smoke test, pagination | Planned |
| M4 | Session security | Refresh tokens in httpOnly cookies, logout everywhere, Postgres RLS | Planned |
| M5 | Observability | Prometheus metrics, OpenTelemetry traces, dashboards | Planned |
| M6 | Board at scale | Drag and drop, ordering within a column, performance budget for large projects | Planned |
| M7 | Enterprise identity | OIDC SSO, SCIM provisioning, domain-verified orgs | Planned |
| M8 | Collaboration | Comments, mentions, email invitations, notifications | Planned |
| M9 | Real time | Live board updates over WebSockets | Planned |
| M10 | 1.0 | Stable public API with versioning and deprecation policy | Planned |

## Release plan

| Version | Contents |
|---|---|
| v0.1 | M1 and M2 (current `main`) |
| v0.2 | M3 |
| v0.3 | M4 and M5 |
| v0.4 | M6 and M8 |
| v0.5 | M7 and M9 |
| v1.0 | M10 |
