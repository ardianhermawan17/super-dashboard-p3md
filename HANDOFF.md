---
updated: 2026-09-26 19:05
project: super-dashboard-p3md-architecture
---

## Current Card

**None in progress.** Three cards landed to Review this session (all PRs open, awaiting merge):

| PR | Task | What it landed | Verification |
|----|-----|----------------|--------------|
| [#37](https://github.com/ardianhermawan17/super-dashboard-p3md/pull/37) | PSI-071 · M8 agent layer | `agent_board_status/agenda/inbox/documents` security_invoker views + `agent_audit_log` + `digests`; `20260926060000_m8_agent_layer.sql` | 8 files / 76 tests PASS (17 in agent_layer.test.sql) |
| [#38](https://github.com/ardianhermawan17/super-dashboard-p3md/pull/38) | PSI-072 · Agent tool registry | `frontend-architecture/src/agent/` — define/registry/runtime/links + 5 read tools + 8 unit tests | lint 0/0, typecheck clean, build pass, 13/13 frontend tests |
| [#39](https://github.com/ardianhermawan17/super-dashboard-p3md/pull/39) | PSI-080 · M9 talent | `20260926070000_m9_talent.sql` — 6 tables + RLS inline, private `cvs` bucket, `candidate_group_scores` security_invoker | 17/17 talent.test.sql, 8 files / 76 tests PASS |

Previous open PRs on the same board:
- **#36** (PSI-065 `/sync`) — open since earlier, untouched this session.
- **#35** (PSI-099) — merged `0cb2229`, stamped done by operator.

## Board State (lanes)

35 backlog / 0 todo / 1 doing (PSI-060, yours) / 1 review (PSI-065) + 3 new review / 0 blocked / 38 done.
Wait — PSI-071/072/080 are now `review` in the source, so Review lane will show 4 once vault syncs.

## Master State

`master` = `origin/master` = **`876f871`**. PRs #36–#39 are open on top, not merged.

## Next Ready Cards (dependency-ordered, all code-implementable)

1. **PSI-081** (Consent & CV intake — backend; depends PSI-080 ✅ done)
2. **PSI-097** (AgentShield in CI — security workflow; depends PSI-009 ✅ done)
3. **PSI-096** (Hermes standing jobs — agent-ops; depends PSI-095 ✅, PSI-006 ✅)
4. **PSI-042** (Event form with audience picker — frontend; depends PSI-041 ✅)
5. **PSI-073** (MCP endpoint — backend; depends PSI-072 — **blocked until #38 merges**)

Human-blocked: PSI-025 (device QA), PSI-031 (Resend key), PSI-090 (Vercel), PSI-062/063/064/066 (need PSI-060 calendar/drive sharing), PSI-074+ (OAuth hosted config).

## Test Status

unit: 8/8 (agent) · 13/13 (frontend total) · full pgTAP suite: **8 files / 76 tests PASS** ·
lint: 0 warnings 0 errors · typecheck: clean · build: pass ·
`bun run agent:check`: ok (75 tasks, 44 history entries)

## Recurring Gotchas (learned this session — port to a skill)

- **`.gitignore` plugins rule keeps vanishing**: `obsidian-out/.obsidian/plugins/` must be in `.gitignore`,
  but it only exists on branches that added it. Master never got it because #36/#37/#38 carry it.
  Until one of those merges, EVERY branch cut from master re-sweeps third-party plugin code
  (remotely-save bundles a Google OAuth client id+secret) and GitHub Push Protection rejects the push.
  Fix pattern: add the line to `.gitignore` on the new branch before `git add -A`.
- **`supabase db reset` exits 502** after migrations apply cleanly: `supabase_vector_p3md` crash-loops
  against the Docker socket. Not a migration failure — verify in psql via `docker exec supabase_db_p3md`.
- **`server-only` throws under `bun test`**: stub with `mock.module('server-only', () => ({}))` before
  dynamic-importing the runtime.
- **View columns come back nullable** in `database.types.ts`: default/filter at the call site, don't cast.
- Schema: `changes[].action` enum is `added/modified/deleted/renamed`; `migrations[]` wants the full
  repo path (`supabase/migrations/….sql`).

## Exact Next Action

Pull **PSI-081** (Consent & CV intake) onto a branch off master — builds directly on M9.
Or if the operator wants PRs merged first: merge #37 → #38 → #39 in dependency order, then rebase.