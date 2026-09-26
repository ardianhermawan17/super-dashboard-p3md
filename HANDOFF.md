---
updated: 2026-09-26 10:55
project: super-dashboard-p3md-architecture
---

## Current Card

`PSI-067 · Admin: Integrations page` — **review**. Code complete: lint/typecheck/build/DB
tests all green. Branch `task/PSI-067`, commit `7cdbd86`, PR **#33** (open, CLEAN/MERGEABLE).
Card waits for the operator's manual stamp to `done` in Obsidian.

`PSI-061 · Migration M6 Google` remains in **review** — PR **#31** open, now rebased onto
master and CLEAN/MERGEABLE (was CONFLICTING). Commit `ec2547c`.

**Operator decision 2026-09-26 (still in force):** PSI-061 stays in `review`; the human
reviews PRs manually. Never move a card to `done` — only the operator does that.

## Next Card

Nothing is claimable until a dependency clears. Phase 6 is exhausted for agent work:
every remaining card needs either PSI-061's schema merged or PSI-060's GCP setup.
→ Phase 7 (MCP read API, `PSI-070+`) is the next workable track once the operator decides.

`PSI-062 · google-drive /sync` — **blocked on PSI-060** (human: Google Cloud project,
service account, `GOOGLE_SA_KEY_B64` secret, Drive + Calendar APIs enabled, document
roots/calendars shared with the SA email). Runbook: `docs/backend-architecture/google-integration.md`
§ "Google Cloud setup (human, once)". No agent may touch GCP; contract C-15.

`PSI-063` depends on PSI-062. `PSI-064` depends on PSI-063. `PSI-065`/`PSI-066` depend on PSI-060.

## Last Commit

`7cdbd86` — feat(admin): add Google Workspace Integrations page [card: PSI-067]

## Pull Requests

| PR | Task | Branch | State |
|---|---|---|---|
| [#32](https://github.com/ardianhermawan17/super-dashboard-p3md/pull/32) | PSI-060 blocked + board corrections | `task/PSI-060` | ✅ **MERGED** (`4be3b8d`) |
| [#31](https://github.com/ardianhermawan17/super-dashboard-p3md/pull/31) | PSI-061 Migration M6 Google | `task/PSI-061` | OPEN, CLEAN/MERGEABLE (rebased) |
| [#33](https://github.com/ardianhermawan17/super-dashboard-p3md/pull/33) | PSI-067 Admin Integrations page | `task/PSI-067` | OPEN, CLEAN/MERGEABLE |

## Test Status

unit: n/a · full suite: **pass** (6 pgTAP files / 50 tests) ·
lint: pass (0 warnings, 0 errors) · typecheck: pass · build: pass ·
`bun run agent:check`: ok (74 tasks, 41 history entries) · acceptance: n/a

No browser acceptance run for PSI-067: the page needs a signed-in user holding
`integrations.manage`, and `jev-ultrafast` was not running this session. That is the one
gap in PSI-067's verification — note it as a Jev N/A, not an app bug.

## In-flight Assumptions

- PSI-067 is branched from `task/PSI-061`, not master, because it consumes the M6 tables.
  **Merging #33 before #31 will fail on missing schema.**
- `triggerSyncAction`'s silent failure path is intentional while PSI-062/065/066 are undeployed.
- `requireAnyPermission` is new — added to `src/lib/auth/require.ts` alongside `requirePermission`.

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

- Merge order — #31 before #33? And are both approved to merge? (#33 fails on missing schema
  if it lands before #31.)
- Should the Integrations "Sync now" buttons be hidden behind a flag until the sync Edge
  Functions deploy, rather than reporting a queued job that does not run?
- A calendar binding is role-**XOR**-group per the M6 schema. Confirm that is the intended
  product rule.
- `docs/agent-operations/jev-ultrafast.md` and `format.md` are still untracked in the repo
  root/docs. Are they meant to be committed, or are they scratch? Same for
  `graphify-out/2026-09-26/` and the `graphify-out/cache/*.sig`/`.tmp` files.

## Exact Next Action

Ask the operator: merge **#31** then **#33** to master, or open a Phase 7 card. Do not stamp
PSI-067 to `done` — the operator does that manually in Obsidian.

First concrete step for PSI-062 when unblocked: read
`docs/backend-architecture/google-integration.md` and scaffold
`supabase/functions/google-drive/sync/index.ts` (breadth-first mirror, stale-row prune,
per-root `document.added` notify) with the `GOOGLE_SA_KEY_B64` secret read from
`Deno.env`, never from the DB.
