---
updated: 2026-09-27 23:55 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-105 · Agent tool `get_finance`** — DONE, merged into `master` at commit `fe7ce60` (PR #53).

What landed:
- `src/agent/tools/get-finance.ts` (`get_finance`): zod input `{eventId?, boardId?, from?, to?, category?, limit 1..50 (default 20)}`, output `{currency:'IDR', totals:{inflow,outflow,net}, byCategory, recent}` per `finance.md`.
- `agent_finance` (security_invoker view) drives totals/byCategory; `finance_entries` drives recent rows (decimal strings, no creator identities, max 50 rows, deep links).
- Registered in `registry.ts` (6 read tools total) → auto-exposed to MCP (`/api/mcp`) and in-app chat.
- Upgraded the shared `fake-supabase` Builder to apply real `eq/gte/lt/lte/ilike`, `order` and `limit`.
- 6 new tests (`get-finance.test.ts`) + 2 registry/cap tests in `agent.test.ts`.

## Preceding Completed Cards (Phase 10 streamline)

- **PSI-101** · M10 Finance schema & RLS (merged PR #43)
- **PSI-102** · Create event board from calendar (merged PR #49)
- **PSI-103** · Finance module with CRUD (merged PR #51)
- **PSI-104** · Finance on event boards & events (merged PR #52):
  - `getBoardFinanceSummaryAction` / `getEventFinanceSummaryAction`
  - `BoardFinancePanel` (inflow/outflow/net cards, category totals, Add entry, View ledger)
  - `KanbanViewPage` Base UI Tabs (Tasks | Finance) for `finance.read` holders only
  - `TaskFinanceButton` on task cards (dnd-safe) prefilling board + task
  - Event detail dialog finance block (entry count, In/Out/Net, View ledger link)
  - `canReadFinance`/`canWriteFinance` session plumbing; 5 unit tests.

## Next Card

**PSI-106 · Finance charts on the overview**
- Depends: PSI-103 (done).
- Accept: Overview shows inflow vs outflow per month and outflow by category using the template bar and pie graphs, only for users with `finance.read`, with loading skeletons and an empty state.

## Test & Build Status

- Frontend unit tests: **56/56 passing** (`bun test src/`)
- Edge functions tests: **15/15 passing** (`bun test supabase/functions/`)
- Typecheck: `tsc --noEmit` **0 errors**
- Lint: `oxlint` **0 warnings, 0 errors**
- Agent check: `agent:check` **OK** (86 tasks, 65 history entries)
- pgTAP: 135 passing

## Open Follow-ups

1. **Browser walkthrough of finance** (inherited PSI-103 gap): `/dashboard/finance` ledger, board Finance tab math, task-card Add entry prefill, event net block. Seeded user `admin@p3md.test` has `finance.read/write/manage`.
2. **Live MCP probe**: call `get_finance` via `/api/mcp` and watch the audit row land in `agent_audit_log`.

## Exact Next Action

Claim PSI-106 on `task/PSI-106`, implement finance charts (inflow vs outflow monthly bar + outflow by category pie) on the overview page guarded by `finance.read`, with skeleton/empty states.