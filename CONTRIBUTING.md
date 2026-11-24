# Contributing

## Workflow

`main` is always releasable. Work happens on short-lived branches named
`<type>/<issue>-<slug>`, for example `feat/42-balance-snapshots`, and lands
through a pull request.

1. Pick an issue from **Ready** on the project board, or open one first for
   anything bigger than a typo. Non-trivial design goes in an ADR under `docs/adr/`.
2. Keep the PR small enough to review in one sitting (roughly under 400 changed lines).
3. Run the checks locally: `npm run lint && npm run typecheck && npm test`.
4. CI must be green and one code owner must approve. PRs are squash-merged,
   so the PR title becomes the commit message.

## Commit and PR titles

[Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`,
`perf`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`, with an optional
scope, e.g. `fix(api): ...`. A `!` or a `BREAKING CHANGE:` footer
marks an incompatible change and forces a major version bump.

## Labels

| Group | Labels |
|---|---|
| Type | `type/bug`, `type/feature`, `type/chore`, `type/docs`, `type/security` |
| Area | `area/api`, `area/web`, `area/shared`, `area/auth`, `area/ops` |
| Priority | `priority/p0` (drop everything), `priority/p1` (this milestone), `priority/p2` (when there's room) |
| Status | `status/triage`, `status/blocked` |
| Help | `good first issue` |

## Project board

Columns: **Triage → Ready → In progress → In review → Done**. An issue is
*Ready* when it has acceptance criteria, an area, a priority and a milestone.
Work in progress is limited to two items per person.

## Releases

Versions follow [SemVer](https://semver.org/). A release is a signed tag
`vX.Y.Z` on `main`; the changelog is generated from the squashed commit
titles and edited by hand before publishing. The release roadmap lives in
[docs/roadmap.md](docs/roadmap.md).

## Definition of done

- Acceptance criteria met and covered by tests
- Observability added for anything that can fail in production (log, metric, or both)
- Docs and ADRs updated
- No new lint warnings; no skipped or quarantined tests
