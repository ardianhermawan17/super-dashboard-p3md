# Task lifecycle, CPM network and earned value

> **Scope:** sub-tasks, delegation, the start/finish cash gates on the kanban board; the CPM/PERT engine; the Schedule tab (network table + Gantt); the Earned value tab; how one board query feeds all three. Schema and gates: [m12-task-lifecycle-cpm.md](../../database-architecture/m12-task-lifecycle-cpm.md).
> Builds on: [kanban.md](kanban.md), [finance.md](finance.md) · Index: [frontend-architecture/](../README.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)
> Tasks: PSI-117 (lifecycle UI) · PSI-118 (drag gates) · PSI-119 (engine) · PSI-120 (Schedule + Gantt) · PSI-121 (EVM) · PSI-122 (pipeline) · PSI-123 (bugs that block PSI-118). Agent brief: [phase-11-brief.md](../../agent-operations/phase-11-brief.md).

## Flow

```
Board tabs:  Tasks │ Schedule │ Earned value │ Finance
             ──────┼──────────┼──────────────┼────────
one query:   scheduleKeys.board(id) → { tasks, links, budgets? , projectStart }
             │
             ├─ Tasks        cards, sub-task counts, delegate badges, start/finish dialogs on drag
             ├─ Schedule     computeSchedule(tasks, links)  → network table + frappe-gantt timeline
             └─ Earned value computeEvm(tasks, budgets, schedule, step) → recharts line (PV, EV, AC)
```

Schedule and EVM are **derived in the browser** with `useMemo` from that one query. There is no second fetch and no stored computation, so any change that invalidates the board query updates all three tabs.

## Module layout (mirror the existing kanban/finance features)

```
src/features/kanban/                      # lifecycle lives with the board
  actions.ts                              # + startTaskAction, finishTaskAction, setDelegateAction, createSubtaskAction
  components/start-task-dialog.tsx        # initial cost
  components/finish-task-dialog.tsx       # final cash + outflow category
  components/subtask-list.tsx             # inside task-detail-dialog
  components/delegate-picker.tsx          # Users | Groups
src/features/schedule/                    # new feature
  actions.ts                              # getBoardScheduleAction, setEstimateAction, linkTasksAction, unlinkTasksAction, setProjectStartAction
  types.ts                                # Zod schemas + inferred types
  api/keys.ts                             # scheduleKeys.all / board(id)
  lib/pert.ts        lib/pert.test.ts     # PSI-119 engine (pure)
  lib/evm.ts         lib/evm.test.ts      # PSI-121 maths (pure)
  lib/normal-cdf.ts                       # Φ(z), no dependency
  components/schedule-tab.tsx
  components/schedule-controls.tsx        # target, k·σ, unit — URL state via nuqs
  components/network-table.tsx
  components/link-editor.tsx
  components/gantt-timeline.tsx           # frappe-gantt wrapper (client only)
  components/evm-tab.tsx
  components/evm-chart.tsx                # recharts
```

Conventions (AGENTS.md, C-09): TanStack Query SSR pattern, `useAppForm` + Zod, Base UI `render` prop (never `asChild`), icons only from `@/components/icons` (add any missing icon there first), money via `finance/lib/format.ts` (`formatIDR` → "Rp 2.000.000"), dates WIB, motion only through `@/components/ui/motion-safe` helpers (PSI-112).

## Permissions in the UI (mirror, never replace, the DB)

| UI element | Shown when |
|---|---|
| Planned cash field in the new-task dialog | caller has `task.budget` (otherwise the task is created unbudgeted, no field) |
| Start / Finish dialogs, and dragging across kinds | caller has `task.budget` **and** is the task author or delegate |
| Cash values on cards, in the panel, Earned value tab | `task.budget` or `finance.read` (members without either see **no amounts anywhere**) |
| Delegate picker | caller is the task author or the board owner |
| Schedule tab, links, estimates | any board member |

Server Actions still call `requirePermission('task.budget')` (C-17) and rely on RLS and the gate triggers for the rest. A hidden button is convenience, not security.

## PSI-117 · Sub-tasks and delegation

- **New-task dialog:** column picker lists only `kind = 'todo'` columns (the DB refuses others). Planned cash is required when the field is shown (Zod: integer rupiah ≥ 0, displayed "Rp 2.000.000"). Optional outflow category for the later ledger post.
- **Task panel** (`task-detail-dialog.tsx`): a Sub-tasks section lists children with their column kind, "Add sub-task" (title and planned cash; same rules as a task), and a `done/total` count also rendered on the card. One level only; the panel of a sub-task shows its parent as a link instead.
- **Delegation:** `delegate-picker.tsx` with two tabs. **Users** lists board members, including members through board groups (server list, not the whole directory). **Groups** lists `board_groups`. Picking one clears the other, since the DB allows at most one delegate. Cards show an avatar for a user or a group chip for a group.
- **"Delegated to me" filter** on the board header: `assignee_id = me` or `assignee_group_id ∈ my groups`, from the session's group ids.
- Fields the caller may not edit render **read-only**, not as errors after submit.

## PSI-118 · Start and finish gates on drag

```
onDragEnd(card, targetColumn):
  if kind(source) === kind(target)      → existing optimistic move (kanban.md), no gate
  if target is 'doing' and source 'todo' → open StartTaskDialog  { pendingMove }   // no optimistic update
  if target is 'done'  and source 'doing'→ open FinishTaskDialog { pendingMove }
  if target is 'done'  and source 'todo' → toast "Start the task first", no move
  if leaving 'done' or 'doing' backwards → confirm "Reopen task?" then moveTask (the DB clears stamps / ledger row)
confirm → startTaskAction / finishTaskAction → RPC start_task / finish_task (one transaction)
          → ok: invalidate scheduleKeys.board + kanbanKeys.board + financeKeys.summary
          → { ok: false, error }: toast(error); card stays where it was
cancel  → nothing was moved, so nothing to roll back
```

- The card only moves after the server says yes. A gated drop therefore never needs a rollback, and the card simply stays in its source column while the dialog is open.
- **Keyboard / no-drag path:** the task panel has **Start** and **Finish** buttons that open the same dialogs and target the first column of the next kind.
- The Finish dialog lists outflow categories (default: the task's planned category, else "Other") and states that the amount is posted to the board's finance ledger.
- **Depends on PSI-123:** today a button inside a card (`task-finance-button.tsx`) starts a dnd-kit drag instead of clicking. Fix that before adding more card buttons: stop propagation on `pointerdown`, or use a dnd-kit activation constraint (distance ≥ 5 px).

## PSI-119 · CPM/PERT engine (`schedule/lib/pert.ts`)

Pure TypeScript, no React, no dates (days as numbers), no throwing: it returns results or typed errors.

```ts
export type PertTask = { id: string; a: number; m: number; b: number };   // days, 0 ≤ a ≤ m ≤ b
export type TaskLink = { from: string; to: string };                      // finish-to-start

export type NodeResult = {
  id: string;
  te: number; variance: number; sd: number;          // (a+4m+b)/6, ((b−a)/6)², √variance
  es: number; ef: number; ls: number; lf: number;
  slack: number;                                      // ls − es
  critical: boolean;                                  // |slack| < 1e-9
  pathVariance: number;                               // Σ variance along the driving path into and including this node
};
export type Schedule = {
  nodes: Record<string, NodeResult>;
  order: string[];                                    // topological
  projectTe: number;                                  // max EF
  criticalPath: string[];
  projectVariance: number;                            // Σ variance on the critical path; ties → the larger
  projectSd: number;
};
export type ScheduleError =
  | { kind: 'cycle'; ids: string[] }
  | { kind: 'missing-estimate'; ids: string[] }       // a linked task has no a/m/b
  | { kind: 'invalid-estimate'; ids: string[] };      // not 0 ≤ a ≤ m ≤ b

export function computeSchedule(tasks: PertTask[], links: TaskLink[]):
  { ok: true; value: Schedule } | { ok: false; error: ScheduleError };
export function targetProbability(s: Schedule, targetDays: number): { z: number; probability: number };
export function sigmaRange(s: Schedule, k: number): { low: number; expected: number; high: number };
export function slackBand(n: NodeResult, k: number): { low: number; high: number };   // slack ∓ k·√pathVariance
```

- **Forward pass:** ES = max(EF of predecessors), or 0; EF = ES + TE. **Backward pass:** LF = min(LS of successors), or `projectTe` for end nodes; LS = LF − TE.
- **Probability:** z = (target − projectTe) / projectSd; probability = Φ(z) (Abramowitz–Stegun erf, |error| < 1.5e-7). If `projectSd = 0`, probability is 1 when target ≥ projectTe, else 0.
- **"SLACK measurable time" (operator's term):** slack with its uncertainty. `sigmaRange(k)` gives the project range TE ± kσ; for k = 2 that is "−2σ optimistic, 0 expected, +2σ pessimistic". `slackBand(k)` gives each task's slack ∓ k·σ of its path. A low bound < 0 means the task can become critical at that confidence.
- Unestimated **and** unlinked tasks are simply left out ("unscheduled" list in the UI); they are not an error.

**Required test fixture** (weeks shown; the engine takes days = weeks × 7, so assert on days ÷ 7). Target 38 weeks:

| Node | a | m | b | after | TE | var | ES | EF | LS | LF | slack |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | 4 | 8 | 12 | — | 8 | 1.778 | 0 | 8 | 0 | 8 | 0 |
| B | 6 | 9 | 18 | A | 10 | 4.000 | 8 | 18 | 8 | 18 | 0 |
| C | 5 | 6 | 7 | A | 6 | 0.111 | 8 | 14 | 12 | 18 | 4 |
| D | 10 | 12 | 20 | B, C | 13 | 2.778 | 18 | 31 | 18 | 31 | 0 |
| E | 3 | 4 | 5 | D | 4 | 0.111 | 31 | 35 | 31 | 35 | 0 |

Critical path A-B-D-E, TE = 35 weeks, variance 8.667, σ = 2.944, z(38) = 1.019, probability ≈ 0.846, and 2σ range = 29.11 … 40.89 weeks. Also test: a cycle, a missing estimate on a linked task, a zero-duration milestone, two equal-length critical paths, and an empty network.

## PSI-120 · Schedule tab and Gantt (frappe-gantt)

- **Dependency:** `frappe-gantt` (MIT). Record it in `dependencies_added` with its reason (C-10). Check its current API and CSS import at implementation time (the options changed between major versions) and pin the version.
- **Wrapper** `gantt-timeline.tsx`: a client component with `next/dynamic` and `ssr: false`. The library touches the DOM. Create it once per mount: `new Gantt(ref.current, rows, { view_mode, readonly: true, … })`; on data change call its refresh/update method; on unmount clear the container.
- **Rows:** one per scheduled task. `start = projectStart + ES days` and `end = projectStart + EF days` (WIB dates), `dependencies` = predecessor ids, `progress` = 0 / 50 / 100 by column kind, `custom_class = 'bar-critical'` on the critical path. Sub-tasks sit right after their parent and their title is indented with "↳".
- **Read-only bars:** dates are computed, so dragging a bar would fight the engine. To change the schedule, edit estimates or links.
- **Theme:** scope a small stylesheet that maps the library's colours to the OKLCH theme tokens (`--primary` for bars, `--destructive` for `bar-critical`) and works in dark mode.
- **Network table:** task, a/m/b, TE, variance, σ, ES, EF, LS, LF, slack, slack band (±kσ), critical badge. Estimates are editable inline (Zod: 0 ≤ a ≤ m ≤ b). "Unscheduled" list below.
- **Link editor:** "Add predecessor" combobox (same board, excluding self and anything that would close a cycle, checked client-side too). The DB rejects cycles regardless.
- **Controls (nuqs):** `?target=<days>&k=<1|2|3>&unit=<day|week>&view=<Day|Week|Month>`. They show "TE 35 w ± 5.9 w (k=2)" and "P(finish ≤ 38 w) = 84.6 %".
- **Project start:** header date picker writing `boards.project_start`. Its placeholder is the linked event's date, then the board's creation date.

## PSI-121 · Earned value tab (recharts)

Definitions (standard EVM, operator decision):

| Series | At bucket end *t* |
|---|---|
| **PV**, planned value | Σ planned_cash × clamp((t − startDate) / (endDate − startDate), 0, 1) over **scheduled** tasks, with start/end from the CPM ES/EF dates. A zero-length task counts fully once t ≥ its date |
| **EV**, earned value | Σ planned_cash × completion(t): **0 %** before `started_at`, **50 %** from `started_at`, **100 %** from `finished_at` |
| **AC**, actual cost | Σ **initial_cost** from `started_at` until `finished_at`, then **final_cash** from `finished_at`. The final figure **replaces** the initial one; it is not added |
| CPI = EV / AC · SPI = EV / PV | at the latest bucket ≤ today, "—" when the divisor is 0 |
| BAC | Σ planned_cash |

- Parents and sub-tasks each count their **own** cash (no roll-up double counting). Unbudgeted tasks are listed under the chart, not plotted.
- **Buckets:** `?step=1d|7d|14d|1m`, default `7d`, from project start to max(project end, today). PV spans the whole range; EV and AC stop at today.
- **Chart:** `LineChart` with three `Line`s, using the finance feature's chart colours. "Point styling" = a distinct `dot` shape per series (PV circle, EV triangle, AC diamond) through a custom `dot` render. y-axis uses `formatIDR` compact; tooltip shows all three plus CPI and SPI for that bucket. Mind recharts' `activeDot` size so the shapes stay readable.
- `evm.ts` is pure and tested: completion boundaries, the replace rule for AC, zero-length tasks, empty board, and a board with only unbudgeted tasks.

## PSI-122 · Pipeline end to end

- `getBoardScheduleAction(boardId)` returns tasks (with parent, delegate, kind, stamps and estimates), links, `projectStart` and, **only when RLS returns rows**, budgets. The client never tries to read `task_budgets` for someone without the permission.
- `use-board-realtime.ts` also listens to `task_links` and invalidates `scheduleKeys.board(id)` on `tasks` and `task_links` changes. `task_budgets` is not published on purpose (m12 doc). Budget changes arrive with the `tasks` change that start or finish always makes.
- A board created from a calendar event (PSI-102) starts its network on the event's date unless `project_start` is set.
- **e2e (Playwright):** as project-manager, create a task with planned cash and estimates → link it after another → as operation, start with initial cost → finish with final cash. Assert the Gantt bar position, the PV/EV/AC values at the finishing bucket, and one `task_final` row in the ledger. Then, as accountant, check the EVM tab is visible (via `finance.read`) and that the Start button is not shown.
