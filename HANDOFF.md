---
updated: 2026-09-26 10:05
project: super-dashboard-p3md-architecture
---

## Current Card

**None in progress.** `PSI-060 · Google Cloud project, service account, sharing` is **blocked**
by operator decision (2026-09-26): *"I will do it later."* Runbook ready at
`docs/backend-architecture/google-integration.md` § "Google Cloud setup (human, once)"
(base64 / Windows commands included). No agent may touch GCP — contract C-15.

## Next Card

**Any unblocked card.** With PSI-060 blocked, `PSI-062` / `PSI-065` / `PSI-066` are unreachable.

Recommended: `PSI-067 · Admin: Integrations page` — depends only on **PSI-061**, area
`frontend`, no GCP access needed. It can be built and reviewed against the M6 schema
(PR #31 branch) right now. Caveat: PSI-067's "Sync now" button calls
`google-drive/sync` and `google-calendar/sync`, which do not exist until PSI-062/065 — so
that one action must be stubbed or left disabled with a clear TODO.

`PSI-061` is **review** — PR #31 open, **unmerged**. **Operator will review manually. Do NOT
merge it and do NOT move the card to `done`.**

## Last Commit

`2597dc0` — Merge pull request #30 from ardianhermawan17/main (remote master head at branch time)

## Test Status

unit: n/a · full suite: not re-run on this branch (docs/board-only change) ·
last full run on PSI-061: pass (6 pgTAP files / 50 tests) · lint: n/a · build: n/a ·
`bun run agent:check`: ok (74 tasks, 39 history entries)

## Board deltas on this branch

- `PSI-060`: `todo` → `blocked`, with the blocker reason and runbook pointer recorded in
  `docs/list-task-project.md` (the board generator ignores unknown `- blocked:` / `- runbook:`
  keys, so they are documentation for humans, not rendered fields).
- `PSI-061`: `todo` → `review` **on `master`**. The review status only existed on
  `task/PSI-061`; master's board was still showing `todo`, which was misleading.

## In-flight Assumptions

- `docs/database-architecture/m6-google.md` is the authoritative M6 spec; the migration on
  `task/PSI-061` matches it 1:1 plus idempotency guards.
- The Google Edge Functions (`google-drive/*`, `google-calendar/*`) do not exist yet. The M6
  triggers and cron jobs reference them by path and will 404 until PSI-062/065/066 land. The
  migration is still valid; the push triggers are simply inert in practice. This is expected.
- No GCP resource has been touched, read, or modified.

## Unresolved Questions

- `HANDOFF.md` now exists on both `task/PSI-061` and `task/PSI-060`. When both merge, expect a
  conflict here — resolve by taking the newer `updated:` stamp, not by picking a side blindly.
- `docs/agent-operations/jev-ultrafast.md` and `format.md` are untracked in the repo.
  Commit or delete? Operator has not said.
- PR #31 will need a rebase or merge from `master` (which moved to `2597dc0` via PR #29/#30)
  before it can land, once the operator approves it.

## Exact Next Action

Await operator. Two live options:

1. Operator finishes PSI-060 → claim `PSI-062 · google-drive /sync` on `task/PSI-062`.
   First step: scaffold `supabase/functions/google-drive/sync/index.ts` — breadth-first mirror
   of every enabled root (Shared Drives included), stale-row prune, `last_synced_at` /
   `last_error`, one `document.added` notification per root that gained files. Read
   `GOOGLE_SA_KEY_B64` from `Deno.env` — never from the DB, never logged.
2. Operator says "Start PSI-067" → claim `PSI-067 · Admin: Integrations page` on
   `task/PSI-067` off `master`. Needs PSI-061's schema, which is on the unmerged PR #31
   branch — so either branch off `task/PSI-061` or wait for the merge.
