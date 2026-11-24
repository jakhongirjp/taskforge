# ADR-0002: Fastify + Drizzle instead of a heavier framework and ORM

- Status: accepted
- Date: 2026-11-24

## Decision

The API uses Fastify 5 with plain functions per module, Zod for validation and
Drizzle ORM for typed SQL.

## Why

- Fastify gives us schema-friendly routing, hooks, encapsulated plugins (used
  for the tenant guard) and `inject()` for fast, server-less HTTP tests.
- Drizzle keeps queries close to SQL (`FOR UPDATE`, `ON CONFLICT`, atomic
  counters) while still being fully typed, and generates plain SQL migrations
  that are reviewed in pull requests.
- Zod schemas live in `packages/shared` so the web app reuses them.

## Trade-offs

- Less built-in structure than NestJS; we compensate with a strict module
  layout (`modules/*`, `rbac.ts`, `context.ts`) and ESLint rules.
- Drizzle has no unit-of-work; transactions are explicit, which we prefer for
  a system where the audit log must commit with the change.
