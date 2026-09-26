---
updated: 2026-09-26 12:45
project: super-dashboard-p3md-architecture
---

## Current Card

`PSI-060 · Google Cloud project, service account, sharing` — **partially unblocked / ready for closeout**.
- The service-account key `service-key-p3md-coding-squid.json` is on disk (`.gitignored`, never committed).
- SA identity: `p3md-sync@project-c3a74e7a-ee76-4908-963.iam.gserviceaccount.com`.
- Google Calendar API tested & confirmed **active / reachable (HTTP 200)**.
- `supabase/functions/.env` written with `GOOGLE_SA_KEY_B64` + `GOOGLE_SA_EMAIL` (ignored).
- `frontend-architecture/.env.local` written with `GOOGLE_SA_EMAIL` (ignored).
- Human tutorial added: `docs/agent-operations/tutorial-google-calendar-api.md`.
- **Waiting on:** human sharing target calendar with the SA email. Once shared, operator moves PSI-060 → `done` in Obsidian.

## Merged to Master (this session)

| PR | Task | Merge Commit | What it landed |
|---|---|---|---|
| [#32](https://github.com/ardianhermawan17/super-dashboard-p3md/pull/32) | PSI-060 block + board fix | `4be3b8d` | Board alignment on master |
| [#31](https://github.com/ardianhermawan17/super-dashboard-p3md/pull/31) | PSI-061 Migration M6 Google | `2ad66fc` | Drive/Calendar schema, RLS, triggers, pgTAP tests |
| [#33](https://github.com/ardianhermawan17/super-dashboard-p3md/pull/33) | PSI-067 Admin Integrations page | `5ff95a8` | `/dashboard/admin/integrations`, rules, tutorial, graphify update |

## Next Card

Once the operator moves `PSI-060` to `done` in Obsidian:
1. `PSI-065 · google-calendar /pull` — branch `task/PSI-065` (pull cron sync function).
2. `PSI-066 · google-calendar /push` — branch `task/PSI-066` (push trigger function).
3. `PSI-062 · google-drive /sync` — needs Google Drive API enabled on project `566787048974` first.

Alternative if calendar sharing is still in progress:
- Phase 7 (Agent MCP read API): `PSI-070 · Migration M7 activity log`.

## Last Commit

`5ff95a8` — Merge pull request #33 from ardianhermawan17/task/PSI-067

## Test Status

unit: n/a · full suite: **pass** (6 pgTAP files / 50 tests) ·
lint: pass (0 warnings, 0 errors on 282 files) · typecheck: pass · build: pass (all 25 routes registered) ·
`bun run agent:check`: ok (74 tasks, 41 history entries)

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
