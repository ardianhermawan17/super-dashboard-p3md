---
updated: 2026-09-28 03:05 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

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

## Next Card Candidates

- **PSI-107** · Fix: deleting a board that has tasks fails (M7 task activity trigger) — backlog, depends PSI-070 (done). Small bounded fix + pgTAP.
- **PSI-036** · Test harness and mail tests — backlog, depends PSI-035.
- **PSI-042** · Event form with audience picker, WIB display — backlog, depends PSI-041.

## Test & Build Status

- Frontend unit tests: **64/64 passing** (`bun test src/`)
- Edge functions tests: **15/15 passing**
- Typecheck: **0 errors** · Lint: **0 warnings / 0 errors**
- Agent check: **OK** (86 tasks, 67 history entries)

## Open Follow-ups

1. **Browser walkthroughs** (inherited): finance ledger + board Finance tab + event net + overview charts + task detail panel (click, linked event, add entry, drag safety). Seeded user `admin@p3md.test` has `finance.read/write/manage`.
2. **Live MCP probe**: call `get_finance` via `/api/mcp` and watch the `agent_audit_log` row.

## Master State

- `master` @ `a59f331` (PR #55 merge) + docs/obsidian sync commit
- Working tree clean

## Exact Next Action

Claim **PSI-107** (board-delete fix, M7 trigger) — branch `task/PSI-107`, write the failing pgTAP test first (`delete from boards` with a task present), then the new migration. Alternative: PSI-036 (test harness) if a frontend-only loop is preferred.