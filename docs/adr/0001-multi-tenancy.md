# ADR-0001: Shared-schema multi-tenancy with app-level scoping

- Status: accepted
- Date: 2026-11-24

## Context

TaskForge serves many organizations. We must guarantee that one tenant can
never read or change another tenant's data, while keeping operations simple
(one database, one migration path).

## Options

1. Database per tenant: strongest isolation, but migrations, pooling and
   cross-tenant analytics become expensive early.
2. Schema per tenant: similar operational cost with fewer benefits.
3. **Shared tables with an `org_id` column on every tenant-owned row.**

## Decision

Option 3. Tenant scoping is enforced in three places:

1. A request hook resolves `(user, org)` membership before any org route runs
   and attaches a `TenantContext`. Non-members get `404`, not `403`, so the
   existence of an organization is not revealed.
2. Every repository function takes the `TenantContext` and filters on
   `org_id`, including lookups by primary key.
3. Tests try cross-tenant access with both foreign org IDs and foreign
   resource IDs.

## Consequences

- One database to operate, simple migrations, cheap tenants.
- Correctness depends on discipline in the data layer. The next step is
  PostgreSQL row-level security (`SET LOCAL app.org_id`) as defence in depth,
  which this design is ready for because every table already has `org_id`.
