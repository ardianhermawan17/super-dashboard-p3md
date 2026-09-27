---
updated: 2026-09-28 00:05 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-106 · Finance charts on the overview** — DONE, merged into `master` at `f7bbca8` (PR #54).

What landed:
- `src/features/finance/overview-lib.ts` — pure `aggregateFinanceOverview`: monthly inflow/outflow (last 6 months, zero-filled, decimal strings) + outflow by category (top 5 + Other, sum preserved).
- `getFinanceOverviewAction` in `finance/actions.ts` — `finance.read` gated, RLS-scoped, 6-month window.
- `OverviewFinanceGraphs` (recharts bar + pie with empty states) and `FinanceOverviewSkeleton`.
- Parallel slot `@finance/` mounted in `layout.tsx` when session has `finance.read`; non-readers see nothing.

## Completed Phase 10 Streamline (all merged to master)

- **PSI-101** · M10 Finance schema & RLS (PR #43)
- **PSI-102** · Create event board from calendar (PR #49)
- **PSI-103** · Finance module with CRUD (PR #51)
- **PSI-104** · Finance on event boards & events (PR #52)
- **PSI-105** · Agent tool `get_finance` (PR #53)
- **PSI-106** · Finance charts on the overview (PR #54)

## Next Card Candidates

- **PSI-107** · Fix: deleting a board that has tasks fails (M7 task activity trigger) — backlog
- **PSI-109** · Kanban task detail panel (click to open, linked calendar + finance) — backlog
- **PSI-036** · Test harness and mail tests — backlog

## Test & Build Status

- Frontend unit tests: **60/60 passing** (`bun test src/`)
- Edge functions tests: **15/15 passing**
- Typecheck: **0 errors** · Lint: **0 warnings / 0 errors**
- Agent check: **OK** (86 tasks, 66 history entries)
- pgTAP: 135 passing (unchanged; no DB migration in PSI-104/105/106)

## Open Follow-ups

1. **Browser walkthrough of finance** (inherited PSI-103 gap): `/dashboard/finance` ledger, board Finance tab math, task-card Add entry prefill, event net block, overview charts. Seeded user `admin@p3md.test` has `finance.read/write/manage`.
2. **Live MCP probe**: call `get_finance` via `/api/mcp` and watch the audit row land in `agent_audit_log`.

## Master State

- `master` @ commit after PSI-106 merge record (docs + obsidian mirror synced)
- Working tree clean

## Exact Next Action

Pick the top Ready card (check `docs/list-task-project.md` for `status: ready`; PSI-107 is a small bounded fix and PSI-109 is next in the Phase 10 area if preferred). Claim it, branch `task/PSI-XXX`, TDD, gates, PR + merge per the established rhythm.