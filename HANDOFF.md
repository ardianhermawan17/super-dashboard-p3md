---
updated: 2026-09-26 09:45
project: super-dashboard-p3md-architecture
---

## Current Card

`PSI-061 · Migration M6 Google` — **review** (PR #31 open, mergeable, CLEAN).
Branch `task/PSI-061`, commit `fd9dda2`.

## Next Card

`PSI-062 · google-drive /sync` — **blocked on PSI-060** (human: Google Cloud project,
service account, `GOOGLE_SA_KEY_B64` secret, Drive + Calendar APIs enabled, document
roots/calendars shared with the SA email).

Unblocked fallback if PSI-060 stays open: `PSI-067 · Admin: Integrations page`
(depends only on PSI-061) — frontend, can be built against the M6 schema now.

`PSI-063` depends on PSI-062. `PSI-064` depends on PSI-063. `PSI-065`/`PSI-066` depend on PSI-060.

## Last Commit

`fd9dda2` — feat(PSI-061): Migration M6 Google (Drive mirror, calendar links, sync schedules)

## Test Status

unit: n/a · full suite: **pass** (6 pgTAP files / 50 tests) ·
lint: pass (0 warnings, 0 errors) · build: pass · acceptance: n/a (db-only card) ·
`bun run agent:check`: ok (74 tasks, 40 history entries)

## In-flight Assumptions

- `docs/database-architecture/m6-google.md` is the authoritative spec for M6; migration
  matches it 1:1 except for added `if not exists` / `drop trigger if exists` idempotency
  guards and an added `idx_event_google_links_event` index.
- Cron schedules are wrapped in a `pg_cron`-existence guard, matching the M2 convention.
- The Google Edge Functions (`google-drive/*`, `google-calendar/*`) do **not** exist yet —
  the M6 triggers and cron jobs reference them by path and will 404 until PSI-062/065/066 land.
  This is expected and does not break the migration, but it means the push triggers are
  currently inert in practice.
- No GCP resource has been touched. PSI-060 is human-owned and untouched.

## Unresolved Questions

- Does the operator want PR #31 merged now, or held in the Obsidian `review` lane for a
  manual stamp first? (Same question applies to the PSI-050..053 merges, which the operator
  did authorise.)
- `docs/agent-operations/jev-ultrafast.md` and `format.md` are still untracked in the repo
  root/docs. Are they meant to be committed, or are they scratch?

## Exact Next Action

Wait for PSI-061 review, then either:
1. Claim `PSI-067 · Admin: Integrations page` on branch `task/PSI-067` (unblocked), or
2. Wait for the operator to finish `PSI-060`, then claim `PSI-062 · google-drive /sync`.

First concrete step for PSI-062 when unblocked: read
`docs/backend-architecture/google-integration.md` and scaffold
`supabase/functions/google-drive/sync/index.ts` (breadth-first mirror, stale-row prune,
per-root `document.added` notify) with the `GOOGLE_SA_KEY_B64` secret read from
`Deno.env`, never from the DB.
