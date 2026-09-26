---
updated: 2026-09-26 16:20
project: super-dashboard-p3md-architecture
---

## Current Card

`PSI-065 · google-calendar /sync (pull)` — **review**.
- Implementation: `supabase/functions/google-calendar/index.ts` + `mapper.ts`
- Shared helpers: `supabase/functions/_shared/google.ts` (RS256 JWT SA signer) + `_shared/internal.ts` (bearer authentication)
- Unit tests: `supabase/functions/google-calendar/sync.test.ts` (6/6 pass)
- Database tests: `supabase/tests/google.test.sql` (13/13 pass, 64 total across suite)
- Branch: `task/PSI-065`
- PR: **#36** (open, awaiting merge) — head `d36ce8a`

## Board State (after operator stamp)

`PSI-099 · Hermes compute observability` — **done**, stamped by operator 2026-09-26
(merged as PR #35, `0cb2229`). Mirrored into `docs/list-task-project.md` and regenerated
into the vault. Lanes: 35 backlog / 0 todo / 1 doing / 1 review / 0 blocked / 38 done.

## Parallel Human Card

`PSI-060 · Google Cloud project, service account, sharing` — **doing**.
- Project + SA: `p3md-sync@project-c3a74e7a-ee76-4908-963.iam.gserviceaccount.com`
- APIs: Calendar API **HTTP 200**, Drive API **HTTP 200** (both active).
- **Waiting on human:** Share target calendar with the SA email. Currently SA sees 0 calendars.

## Next Card

1. **`PSI-066 · google-calendar /push`** (depends on PSI-065). Route `/push` already stubbed
   in `index.ts`; `_shared/google.ts` already scopes `calendar.events`.
2. Follow-up: **`PSI-071 · Migration M8 agent views, audit log, digests`** (Phase 7, unblocked).

## Test Status

unit: 6 passed (sync.test.ts) · full suite: **pass** (7 pgTAP files / 64 tests) ·
lint: pass (0 warnings, 0 errors on 282 files) · typecheck: pass · build: pass (all 25 routes) ·
`bun run agent:check`: ok (75 tasks, 44 history entries)

## In-flight Assumptions / Gotchas

- `docs/list-task-project.md` is the **source of truth**; `obsidian-out/` is generated.
  Editing the vault by hand is fine, but re-running `scripts/obsidian-sync.ts` overwrites it —
  so a hand-edit must be mirrored into the source file or it is lost on the next sync.
- The generator **strips the `✅ YYYY-MM-DD`** completion stamp the Kanban plugin adds.
  It emits `- [x] <title>` only. The stamp is not part of the generator's contract.
- `obsidian-out/.obsidian/plugins/` is now **gitignored**. Do not commit plugin `main.js`
  files: third-party plugins bundle vendor credentials (`remotely-save` carries a Google
  OAuth client id + secret) and GitHub Push Protection rejects the push.
- `scripts/obsidian-sync.ts --check` compares task **counts**, not lane assignment. A
  hand-moved card passes `--check` even when source and vault disagree on status.