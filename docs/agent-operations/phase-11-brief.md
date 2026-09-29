# Phase 11 brief · kanban task → CPM network → earned value

> **For:** Hermes Agent and Claude Code (and any agent picking up PSI-115 … PSI-123). Read this before claiming any Phase 11 task.
> Designs: [m12-task-lifecycle-cpm.md](../database-architecture/m12-task-lifecycle-cpm.md) (schema, gates, RLS) · [features/cpm-evm.md](../frontend-architecture/features/cpm-evm.md) (UI, engine, charts). Tasks: [list-task-project.md → Phase 11](../list-task-project.md). Contract: [README_AI_AGENT.md](../../README_AI_AGENT.md).

## 1. The job in one paragraph

Each kanban task gets a money lifecycle and a place in a schedule. The **author** creates a task with a **planned cash** budget and can split it into **sub-tasks** (one level). The author **delegates** it to one **user or one group**. The delegate drags it from a *todo* column to a *doing* column, which opens a dialog asking the **initial cost**; that is the "Start". Dragging to *done* asks the **final cash**; that is the "Finish", and it posts that amount to the board's finance ledger. Tasks and sub-tasks are **linked** into a **CPM network** with three-point estimates (a, m, b). The app computes ES, EF, LS, LF, slack, expected time, variance and standard deviation, and shows them on a **Gantt timeline**. From the same data the app plots **earned value** (PV, EV, AC) as a line chart over 1-day / 1-week / 2-week / 1-month buckets.

```
Tasks tab ──planned cash, a/m/b, links──▶ Schedule tab (CPM + Gantt) ──ES/EF dates──▶ Earned value tab (PV/EV/AC)
   └─ start (initial cost) / finish (final cash) ──────────────────────────────────────┘      └─▶ finance ledger
```

## 2. Frozen decisions: do not reinterpret

Approved by the operator on 2026-09-29 (C-15, quoted in the PSI-114 history entry). Changing any of these needs a new "yes" from the operator in the chat thread.

| # | Decision | So you must |
|---|---|---|
| D1 | **Standard EVM.** EV = planned cash × completion (0 / 50 / 100 % for todo / doing / done) | Not plot "initial cash" as EV. CPI = EV/AC, SPI = EV/PV |
| D2 | **AC** = initial cost while in progress, **replaced** by final cash at finish | Not add the two (double counting) |
| D3 | New permission **`task.budget`** → admin, project-manager, operation (not accountant) | Check it with `requirePermission('task.budget')` / `has_permission('task.budget')`; never branch on a role slug (C-17) |
| D4 | Cash lives in **`task_budgets`** (own RLS), never as columns on `tasks` | Keep amounts out of `tasks`, activity-log rows with `board_id`, realtime payloads, and agent output for people without `task.budget` / `finance.read` |
| D5 | Finish **auto-posts** one outflow `finance_entries` row (`source = 'task_final'`); reopen deletes it | Do it in the DB gate (upsert), not only in the UI |
| D6 | Charts: **frappe-gantt** (new dependency) + existing **recharts**. **No chart.js** | Record frappe-gantt in `dependencies_added` (C-10) |
| D7 | Durations stored in **calendar days**; UI toggles days / weeks | Not store weeks; weeks = days ÷ 7 |
| D8 | Gates key on **`board_columns.kind`** (`todo` / `doing` / `done`) | Never match column titles like "In Progress" in code |
| D9 | Gates are **enforced by DB triggers**; the UI only mirrors them | Not trust a hidden button for security |

## 3. Glossary (with the numbers your tests must hit)

| Term | Meaning |
|---|---|
| a / m / b | Optimistic / most likely / pessimistic duration |
| TE | Expected time = (a + 4m + b) / 6 |
| Variance, σ | ((b − a) / 6)², σ = √variance; project σ = √(Σ variance on the critical path) |
| ES / EF | Early start / finish: forward pass, ES = max EF of predecessors |
| LS / LF | Late start / finish: backward pass, LF = min LS of successors |
| Slack | LS − ES; 0 = critical |
| "Slack measurable time" | Slack with its uncertainty: project TE ± k·σ (k = 2 → "−2σ optimistic, 0 expected, +2σ pessimistic"), per-task slack ∓ k·σ of its path |
| z, P | z = (target − TE) / σ, P = Φ(z) = chance of finishing by the target |
| PV / EV / AC | Planned value / earned value / actual cost (see D1, D2) |

**Fixture (weeks), target 38 w.** A(4,8,12), B(6,9,18) after A, C(5,6,7) after A, D(10,12,20) after B and C, E(3,4,5) after D. The expected results:
A ES 0 EF 8 · B 8–18 · C 8–14, slack 4 · D 18–31 · E 31–35; critical path A-B-D-E; TE 35; variance 8.667; σ 2.944; z 1.019; P ≈ 0.846; 2σ range 29.11 – 40.89. The full table is in [cpm-evm.md → PSI-119](../frontend-architecture/features/cpm-evm.md#psi-119--cpmpert-engine-schedulelibpertts).

## 4. Order and parallel lanes

```
PSI-114 design (merged first)
 ├─ PSI-123 bug fixes ─────────────────────────────┐   independent: can start now
 ├─ PSI-119 engine (pure TS, TDD) ───────────────┐ │   independent of the DB
 └─ PSI-115 M12 migration ─┬─ PSI-116 M13 ───────┼─┼─ PSI-120 Schedule + Gantt
                           ├─ PSI-117 lifecycle UI ─ PSI-118 drag gates (needs PSI-123)
                           └──────────────────────┴─── PSI-121 EVM ── PSI-122 e2e pipeline
```

Suggested split; the operator assigns and agents only claim what they are given:
- **Hermes:** PSI-123 now, then PSI-119, then PSI-120 and PSI-121.
- **Claude Code:** PSI-115, PSI-116, then PSI-117, PSI-118 and PSI-122.

The DB migrations stay with one agent because they need a human RLS review. The engine and charts are pure and testable.

## 5. Per-task traps

| Task | Watch out for |
|---|---|
| PSI-115 | Adds a permission key and changes RLS on `finance_entries` (new `source` column): **stop and ask in the thread before merging** (C-15). New migration via `supabase migration new` only (C-06). `is_done` stays and follows `kind` (M5 readers use it); find writers of `is_done` and switch them to `kind`. `bun run db:types` after (C-11) |
| PSI-116 | Cycle check needs the advisory lock, or two concurrent inserts can close a loop. Do not publish `task_budgets` to realtime |
| PSI-117 | New-task column picker = `todo` columns only. Planned cash field only with `task.budget` |
| PSI-118 | No optimistic move on a gated drop. Keyboard path through the panel's Start / Finish buttons. Blocked by PSI-123's drag-swallows-click bug |
| PSI-119 | Pure module, no React, no `Date`. Return typed errors, never throw. Assert the fixture within 1e-3 |
| PSI-120 | frappe-gantt is DOM-only: `next/dynamic` with `ssr: false`, read-only bars. Check its current API and pin the version |
| PSI-121 | Buckets default 7 d, options 1 / 7 / 14 d / 1 month in the URL (nuqs). PV over the full range; EV and AC stop at today |
| PSI-122 | One board query feeds all three tabs; verify by hand as project-manager, operation and accountant (`password123`, local seed only) |
| PSI-123 | The Category combobox bug: the categories exist and RLS allows the read, so debug the component and the `options` wiring, not the SQL |

## 6. Every session, as always

`git pull` → rebase your branch onto `master` → read this brief and the task's history entries → claim (`status: doing`, `owner: agent:hermes`) → branch `task/PSI-NNN` → `graphify query` first → tests first → DoD (§6 of the contract) → one history entry → `status: review` → `bun run agent:check` → **write-mode** `bun scripts/obsidian-sync.ts` and commit the `obsidian-out/history/<id>.md` note (C-22) → PR titled `PSI-NNN: <title>`. Never set `done` (C-21).
