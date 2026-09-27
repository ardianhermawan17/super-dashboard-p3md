---
updated: 2026-09-27 17:35 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-102 · Create an event board from the calendar** — implemented on `task/PSI-102`, commit `c01d186`, **status: review**, **PR #48 open and mergeable**.

What landed:
- `createEventBoardAction(eventId)` (calendar/actions.ts): server action requiring `kanban.write`, early-returns existing board when `boards.event_id` matches (idempotent, backed by DB unique index `idx_boards_event`), inserts board named after the event with `event_id` + `created_by`, 3 default columns (Backlog/In Progress/Done), and copies ONLY group audience rows into `board_groups` (users/roles excluded, per finance.md §1).
- `getCalendarEventsAction`: now attaches `board_id` to each event from a single batched `boards` lookup.
- Calendar UI (`calendar-view.tsx`): event detail dialog shows **Open board** (→ `/dashboard/kanban?boardId=`) when a board exists, else **Create event board** for `kanban.write` holders (spinner + error state). `calendar/page.tsx` passes `canCreateBoard` from session permissions.
- Kanban UI (`kanban-view-page.tsx`): `getBoardAction` returns the linked event; page reads `?boardId=` from search params and shows a **"Linked event: <title> (<date>)"** chip linking back to `/dashboard/calendar`; `kanban/page.tsx` wrapped in `<Suspense>`.
- 5 unit tests (`event-board.test.ts`): naming+event_id+columns, groups-only audience copy, second-click idempotency, permission denial, missing event.
- All gates green: frontend 28/28, edge functions 15/15, pgTAP 135 PASS, tsc clean, oxlint 0 warnings, `agent:check` ok.
- AI session recorded (C-22/C-23: summary renders under PSI-102 `## AI sessions`).

## Master & PR State

- `master` is at `ebf29d5` (PR #45 PSI-066 merged).
- **PR #47 is still open** (`task/PSI-109-priority-reset`, onhold status + pause AI chat/talent + kanban task-detail design).
- `task/PSI-102` is rebased onto `master` (1 commit `c01d186`, clean 16 files, no dependency on PR #47) and open as **PR #48**.
- Working tree is clean, no dev servers running.

## Test Status

- Unit: **28 passed / 0 failed** (frontend) · **15 passed / 0 failed** (edge functions)
- Full suite: **10 files, 135 pgTAP PASS** (`supabase test db`)
- Typecheck & lint: clean (0 warnings, 0 errors)
- Acceptance: **Jev N/A** (not installed in workspace; pre-existing `/auth/sign-in` 500 template bug blocks browser flow; covered deterministically via live local-Postgres probe + pgTAP constraint test)

## Follow-ups / Open Items

1. **Pre-existing `/auth/sign-in` 500**: `src/components/forms/submit-button.tsx` calls `useFormContext()` outside a `formComponent` passed to `createFormHook`. Blocks logged-in browser acceptance for all user-facing cards until fixed (filed in history entry follow_ups, not fixed here — C-02).
2. **PR #47**: still open on GitHub, merge when ready (contains the `onhold` status and paused tasks).
3. **PSI-101 card**: reads `review` on the board although its migration (`20260927031152_m10_finance.sql`) is merged on master (recording gap only).
4. **Next card in the streamline**: **PSI-103 · Finance module with CRUD** (depends: PSI-101, PSI-017 — both satisfied).

## Exact Next Action

Operator merges PR #48 (PSI-102) and PR #47 (priority reset), then the next agent claims **PSI-103** (`status: doing`, `owner: agent:hermes` or `agent:claude-code`, branch `task/PSI-103`).