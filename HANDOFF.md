---
updated: 2026-09-28 06:45 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-107 · Fix: deleting a board that has tasks fails** — code done on `task/PSI-107` (commit `2cdd98f`), **not yet verified**: this session ran in a sandbox with no Docker (`supabase db reset` / `supabase test db` both fail immediately — no `dockerDesktopLinuxEngine` pipe, no `psql`/`pg_prove` on PATH either), so the new pgTAP cases were never executed. Root cause and fix:
- `tasks.board_id` and `activity_log.board_id` both `references boards(id) on delete cascade`. Deleting a board cascades into `tasks`, firing the `tasks_activity` AFTER DELETE trigger per row; that trigger inserted an `activity_log` row with `board_id = old.board_id`, but by the time the cascade reaches `tasks` the parent `boards` row is already gone, so the insert violated `activity_log_board_id_fkey`.
- New migration `supabase/migrations/20260928062634_fix_task_activity_board_delete.sql` re-creates `log_task_activity()` (M7 itself untouched, C-06): in the `DELETE` branch it nulls `board_id` when the board no longer exists instead of failing; `INSERT`/`UPDATE` branches unchanged.
- `supabase/tests/activity_log.test.sql`: plan 9 → 11, added a `lives_ok` case (delete a board with a column + task) and a case proving task deletes on a still-live board still log with `board_id` populated.

**Exact next action:** on a machine/session with Docker, `cd` to the repo, `git checkout task/PSI-107`, then `supabase db reset && supabase test db` (or the equivalent CI job). If green, flip `docs/list-task-project.md` PSI-107 to `status: review` and open the PR; if red, fix and re-run before touching status. Task list still reads `status: doing` on purpose — it was left there rather than `review` because the accept criterion ("pgTAP proves...") is unproven.

## Previous Card

**PSI-109 · Kanban task detail panel** — DONE, merged into `master` at `a59f331` (PR #55).

What landed:
- `updateTaskAction` accepts `column_id` (move columns from the edit dialog).
- `getTaskFinanceEntriesAction` (`finance.read` gated) — task-scoped finance entries.
- `TaskDetailDialog` — edit title/description/priority/column/due_date, linked event banner → `/dashboard/calendar`, finance section with `EntryFormDialog` prefill (board + task); absent from DOM without `finance.read`.
- Drag-safe click on `TaskCard` (6px pointer displacement threshold) so drags never open the dialog.

## Completed Phase 10 Streamline (all merged to master)

- **PSI-101** · M10 Finance schema & RLS (PR #43)
- **PSI-102** · Create event board from calendar (PR #49)
- **PSI-103** · Finance module with CRUD (PR #51)
- **PSI-104** · Finance on event boards & events (PR #52)
- **PSI-105** · Agent tool `get_finance` (PR #53)
- **PSI-106** · Finance charts on the overview (PR #54)
- **PSI-109** · Kanban task detail panel (PR #55)

## Next Card Candidates (after PSI-107 verifies green)

- **PSI-036** · Test harness and mail tests — backlog, depends PSI-035.
- **PSI-042** · Event form with audience picker, WIB display — backlog, depends PSI-041.

## Test & Build Status

- Frontend unit tests: **64/64 passing** (`bun test src/`) — unaffected by PSI-107 (DB-only change)
- Edge functions tests: **15/15 passing** — unaffected by PSI-107
- Typecheck: **0 errors** · Lint: **0 warnings / 0 errors** — unaffected by PSI-107
- pgTAP (`activity_log.test.sql`, plan 11): **not run this session** — needs Docker
- Agent check: **OK** (86 tasks, 68 history entries)

## Open Follow-ups

1. **PSI-107 verification** (blocking, see Current Card): run `supabase db reset && supabase test db` on `task/PSI-107` where Docker is available.
2. **Browser walkthroughs** (inherited): finance ledger + board Finance tab + event net + overview charts + task detail panel (click, linked event, add entry, drag safety). Seeded user `admin@p3md.test` has `finance.read/write/manage`.
3. **Live MCP probe**: call `get_finance` via `/api/mcp` and watch the `agent_audit_log` row.

## Master State

- `master` @ `a59f331` (PR #55 merge) + docs/obsidian sync commit — PSI-107's commit is on `task/PSI-107`, not yet merged
- Working tree clean on `task/PSI-107` as of commit `2cdd98f`