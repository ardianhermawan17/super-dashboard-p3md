---
updated: 2026-09-28 15:10 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-096 · Hermes standing jobs** — setup COMPLETE, `status: doing` (not review — one week of human-reviewed runs required before done, per operator).

The four jobs live in the **Hermes scheduler store** (not repo config), all delivered to `telegram:470957825`, workdir `D:\coding\pflp\super-dashboard-p3md-architecture`:

| Job | Schedule (WIB) | Writes | Last/Next run |
|---|---|---|---|
| `PSI-096 morning pulse` (a3e9af9d79b3) | `0 7 * * 1-5` | Nothing | next 2026-09-29 07:00 |
| `PSI-096 contract check` (e9cc298252ab) | `0 22 * * *` | Nothing | ran ok 2026-09-28 15:02; next 22:00 |
| `PSI-096 weekly graph` (52d300adad2c) | `0 21 * * 0` | Branch + PR only | next 2026-10-04 21:00 |
| `PSI-096 stale work` (11b42f15a1e6) | `0 8 * * 1` | Nothing | next 2026-10-05 08:00 |

Only weekly graph writes — opens `agent/PSI-005-graph-refresh-<date>` + PR only when `GRAPH_REPORT.md` hash changes after `graphify update .`.
**Smoke test**: contract check fired via `cronjob_manage run` → `last_status: ok`, delivered. Pipeline verified end-to-end.

Bookkeeping merged to master via **PR #58** (`fbd79d4`): `docs/list-task-project.md` PSI-096 → doing + history `2026-09-28T07-00-00Z__PSI-096__hermes.json` (outcome `partial`, `human_review.required: true`).

**Exact next action:** operator reviews the first week of runs (contract check first fired today 22:00 WIB); when a week looks good, stamp PSI-096 done (flip status + outcome.

## Recently Merged (this session's context)

- **PSI-107** · board-delete fix — merged PR #56 (`9b0b849`) — new migration nulls `board_id` on task activity when board gone; pgTAP 137 tests pass.
- **PSI-042** · event form audience picker + WIB + rrule — merged PR #57 (`34b6e6f`).
- **PSI-109** · kanban task detail panel — merged PR #55 earlier.

## Backlog state (all other open items are blocked)

- Mail (PSI-032/033/035/036): blocked on PSI-031 (Resend API key — human).
- Google Drive (PSI-062/063/064): blocked on PSI-060 (Google Cloud project — human).
- PSI-077: blocked on PSI-098 (on hold).
- PSI-097 (AgentShield in CI): `review`, owner agent:hermes, depends PSI-009 — needs human review before next step.

## Test & Build Status

- `agent:check` ok: 86 tasks, 71 history entries.
- No code changed this card (scheduler-only).
- Frontend/edge-fn suites last known: 64/64 + 15/15 (unchanged).

## Open Follow-ups

1. PSI-096 one-week acceptance review (operator).
2. Browser walkthroughs (PSI-103/104/106/109) pending seeded-user checks.

## Master State

- `master` @ `fbd79d4` (PR #58). Working tree clean.

## Exact Next Action

Wait on PSI-096 week-of-runs review. If a new unblocked card appears, claim it via the normal flow (branch `agent/PSI-NNN-slug`, history entry, PR).