# M12 + M13 · Task lifecycle, task cash and the CPM network

> **Scope:** sub-tasks, delegation to a user or a group, column kinds, the three task cash figures (planned, initial, final) and the gates that require them (M12); task links and PERT estimates for the CPM network (M13). The earned-value maths is computed in the app, not stored.
> UI: [features/cpm-evm.md](../frontend-architecture/features/cpm-evm.md) · Builds on: [m5-kanban.md](m5-kanban.md), [m10-finance.md](m10-finance.md), [m1-rbac.md](m1-rbac.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)
> Tasks: PSI-114 (this design) → PSI-115 (M12) → PSI-116 (M13) → PSI-117 … PSI-122. Agent brief: [phase-11-brief.md](../agent-operations/phase-11-brief.md).

## The chain this serves

```
kanban task ──(planned cash, a/m/b estimates, links)──▶ CPM network ──(ES/EF per task)──▶ earned value
   │  author plans                                        computed in the app                PV / EV / AC per bucket
   ├─ delegate starts  (initial cost)  → started_at
   └─ delegate finishes (final cash)   → finished_at ──auto-post──▶ finance_entries (outflow, source 'task_final')
```

## Decisions (operator, 2026-09-29, C-15)

| Decision | Choice | Why |
|---|---|---|
| Earned value | Standard EVM: EV = planned cash × completion; completion 0 / 50 / 100 % by column kind | Keeps PV, EV, AC comparable so CPI and SPI mean something |
| Who writes task cash | New key **`task.budget`**, granted to `admin`, `project-manager`, `operation` | Operation delegates must enter costs but hold no `finance.*` |
| Where cash lives | Separate table **`task_budgets`** (1:1 with tasks), not columns on `tasks` | RLS is row-level: every board member reads `tasks`, so amounts on that row would leak (breaks PSI-104's "no amounts anywhere") |
| Ledger sync | Finishing a task upserts one **outflow** `finance_entries` row (`source = 'task_final'`) for its final cash; reopening deletes it | Ledger and EVM always agree; one row per task, idempotent |
| Charts | `frappe-gantt` (new) + existing `recharts`; no chart.js | One new dependency (C-10) |
| Time unit | Durations stored in **calendar days** (`numeric(8,2)`), UI shows days or weeks | Weeks are `days / 7`; working-day calendars are out of scope |
| Column semantics | `board_columns.kind in ('todo','doing','done')`; gates key on kind, never on the column title | Titles are free text per board ("Backlog", "In Progress", …) |

Defaults the operator can change later without a migration: `accountant` does not get `task.budget` (grant it in the role editor if needed); tasks created by someone without `task.budget` are **unbudgeted** (no `task_budgets` row) and the EVM panel lists them as such.

## M12 schema (sketch for PSI-115)

```sql
-- 1. Permission (C-17: new gate = new key, granted to admin in the same migration)
insert into public.permissions (key, module, description) values
  ('task.budget', 'kanban', 'Plan and record cash on tasks you author or are delegated, on boards you belong to')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_key)
select r.id, 'task.budget' from public.roles r
where r.slug in ('admin', 'project-manager', 'operation')
on conflict do nothing;

-- 2. Column kind. is_done stays (M5 readers use it) and is kept equal to kind = 'done' by a trigger.
alter table public.board_columns add column kind text;
update public.board_columns set kind = case
  when is_done then 'done'
  when title ~* '(progress|doing|ongoing|berjalan)' then 'doing'
  else 'todo' end;
alter table public.board_columns
  alter column kind set not null,
  alter column kind set default 'todo',
  add constraint board_columns_kind_check check (kind in ('todo', 'doing', 'done'));
-- before insert or update: new.is_done := (new.kind = 'done')

-- 3. Tasks: sub-tasks, group delegation, lifecycle stamps
alter table public.tasks
  add column parent_id uuid references public.tasks(id) on delete cascade,
  add column assignee_group_id uuid references public.groups(id) on delete set null,
  add column started_at timestamptz,
  add column finished_at timestamptz,
  add constraint tasks_one_delegate check (num_nonnulls(assignee_id, assignee_group_id) <= 1),
  add constraint tasks_not_own_parent check (parent_id is distinct from id);
create index on public.tasks (parent_id) where parent_id is not null;
create index on public.tasks (assignee_group_id) where assignee_group_id is not null;

-- 4. Task cash, 1:1 with tasks, its own RLS
create table public.task_budgets (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  board_id uuid not null references public.boards(id) on delete cascade,   -- = tasks.board_id (trigger), for RLS
  planned_cash numeric(16,2) check (planned_cash >= 0),
  initial_cost numeric(16,2) check (initial_cost >= 0),
  final_cash numeric(16,2) check (final_cash >= 0),
  category_id uuid references public.finance_categories(id),              -- outflow category for the ledger post
  updated_at timestamptz not null default now()
);
create index on public.task_budgets (board_id);

-- 5. Ledger link for the auto-post
alter table public.finance_entries
  add column source text not null default 'manual' check (source in ('manual', 'task_final'));
create unique index idx_finance_entries_task_final on public.finance_entries (task_id) where source = 'task_final';
```

### Helper functions (all `stable security definer set search_path = ''`)

| Function | True when |
|---|---|
| `is_user_board_member(p_board, p_user)` | `p_user` is in `board_members`, or in a group listed in `board_groups` (M5's `is_board_member` only checks the caller) |
| `is_task_delegate(p_task)` | caller is `tasks.assignee_id`, or `tasks.assignee_group_id` is in `my_group_ids()` |
| `can_read_task_budget(p_board)` | `finance.manage`, or board member with `task.budget` or `finance.read` |
| `can_write_task_budget(p_task)` | caller has `task.budget`, is a member of the task's board, and is the task author (`created_by`) or its delegate |

### RLS

```sql
alter table public.task_budgets enable row level security;
create policy "task budgets readable" on public.task_budgets for select to authenticated
  using (public.can_read_task_budget(board_id));
create policy "task budgets inserted" on public.task_budgets for insert to authenticated
  with check (public.can_write_task_budget(task_id));
create policy "task budgets updated" on public.task_budgets for update to authenticated
  using (public.can_write_task_budget(task_id)) with check (public.can_write_task_budget(task_id));
-- no delete policy: rows go with their task (on delete cascade)
```

`tasks` keeps M5's "tasks via membership" policy unchanged. The gates below are triggers, because RLS cannot compare old and new column values.

### Triggers (the gates; the UI only mirrors them)

**`task_budgets` before insert/update**
- `board_id` must equal the task's `board_id`; `updated_at = now()`.
- `planned_cash` may change only when the caller is the task author (a delegate cannot re-plan).
- `category_id`, if set, must be an `outflow` or direction-less category.

**`tasks` before insert or update of `parent_id`, `assignee_id`, `assignee_group_id`**
- Sub-tasks: the parent is on the same board, and the parent has no parent (**one level only**).
- Delegation: `assignee_id` must satisfy `is_user_board_member`; `assignee_group_id` must be in the board's `board_groups`. Only the task author or the board owner may change either field.
- New tasks go into a `todo` column only (a budget row cannot exist before its task, so nothing may be born started).

**`tasks` before update of `column_id` when the column kind changes.** This covers any path: drag, Server Action, RPC or agent.

| From → to | Requires | Sets |
|---|---|---|
| `todo` → `doing` | `can_write_task_budget`; `task_budgets.initial_cost` not null | `started_at = coalesce(started_at, now())` |
| `doing` → `done` | `can_write_task_budget`; `final_cash` not null; every sub-task already in a `done` column | `finished_at = now()`; upsert the `task_final` ledger row |
| `todo` → `done` | refused: "start the task first" | — |
| `done` → `doing` / `todo` (reopen) | `can_write_task_budget` | `finished_at = null`; delete the `task_final` ledger row; `→ todo` also sets `started_at = null` |
| `doing` → `todo` (un-start) | `can_write_task_budget` | `started_at = null` (the `initial_cost` value is kept) |

Moves inside the same kind (reordering, Backlog → another todo column) have no gate.

**Ledger upsert on finish.** Runs inside the security-definer gate, so a delegate without `finance.write` can still trigger it. This is the operator's decision.

```sql
insert into public.finance_entries (board_id, event_id, task_id, category_id, direction, amount,
                                    occurred_on, description, created_by, source)
select t.board_id, b.event_id, t.id,
       coalesce(tb.category_id, (select id from public.finance_categories where slug = 'other')),
       'outflow', tb.final_cash, (now() at time zone 'Asia/Jakarta')::date,
       left('Final cash: ' || t.title, 300), (select auth.uid()), 'task_final'
from public.tasks t join public.boards b on b.id = t.board_id join public.task_budgets tb on tb.task_id = t.id
where t.id = new.id and tb.final_cash > 0
on conflict (task_id) where source = 'task_final' do update set amount = excluded.amount, updated_at = now();
```

A `final_cash` of 0 posts nothing. When `task_budgets.final_cash` is edited on an already-finished task, the same upsert runs from a `task_budgets` after-update trigger. `finance_entries`' own M10 guard trigger and activity logging still apply: finance activity is logged with `board_id = null`, so no amounts leak.

### RPCs: one transaction per start or finish (security invoker, so RLS applies)

```sql
start_task(p_task uuid, p_column uuid, p_position text, p_initial_cost numeric) returns void
  -- upsert task_budgets.initial_cost, then update tasks set column_id, position → gate trigger validates
finish_task(p_task uuid, p_column uuid, p_position text, p_final_cash numeric, p_category uuid default null) returns void
  -- upsert task_budgets.final_cash (+ category), then move → gate trigger validates and posts the ledger row
```

Server Actions call these, not two separate writes, so a failed gate leaves nothing half-written.

### Notifications and activity log

- Group delegation notifies every member of the group (`notify(array(select user_id from group_members …))`) except the actor; user delegation keeps M5's `task.assigned`.
- Start and finish are logged on the task with `board_id` set and **no amounts** in `summary` or `meta` (e.g. `"Started: Book venue"`). Amounts reach the feed only through the finance row. If M7's verb check does not allow `started` / `finished`, extend it in the new migration (never edit M7, C-06).

## M13 schema (sketch for PSI-116)

```sql
-- PERT estimates, in calendar days. 0 allowed for milestones.
alter table public.tasks
  add column est_optimistic numeric(8,2),
  add column est_likely numeric(8,2),
  add column est_pessimistic numeric(8,2),
  add constraint tasks_pert_all_or_none check (
    num_nonnulls(est_optimistic, est_likely, est_pessimistic) in (0, 3)),
  add constraint tasks_pert_order check (
    est_optimistic is null or (0 <= est_optimistic and est_optimistic <= est_likely and est_likely <= est_pessimistic));

-- Day 0 of the network. null → the linked event's start date (WIB) → the board's created_at date.
alter table public.boards add column project_start date;

-- Finish-to-start edges. Any task can link to any task on the same board, sub-tasks included.
create table public.task_links (
  board_id uuid not null references public.boards(id) on delete cascade,
  predecessor_id uuid not null references public.tasks(id) on delete cascade,
  successor_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (predecessor_id, successor_id),
  constraint task_links_no_self check (predecessor_id <> successor_id)
);
create index on public.task_links (board_id);
create index on public.task_links (successor_id);

alter table public.task_links enable row level security;
create policy "task links via membership" on public.task_links for all to authenticated
  using (public.is_board_member(board_id)) with check (public.is_board_member(board_id));
alter publication supabase_realtime add table public.task_links;
```

**`task_links` before insert trigger:** both tasks belong to `board_id`. Take `pg_advisory_xact_lock(hashtext(new.board_id::text))` so two concurrent inserts cannot close a loop between them. Then reject a cycle:

```sql
if exists (
  with recursive reach(id) as (
    select new.successor_id
    union
    select l.successor_id from public.task_links l join reach r on l.predecessor_id = r.id
  ) select 1 from reach where id = new.predecessor_id
) then raise exception 'task link would create a cycle' using errcode = 'check_violation'; end if;
```

Estimates and links are schedule data, not money, so every board member can read and edit them, the same as tasks. `task_budgets` is deliberately **not** in the realtime publication: amounts never travel over realtime. Other members' EVM views refresh when the `tasks` row changes, and every start or finish changes it.

## pgTAP (PSI-115, PSI-116 accept)

**M12**
- `task.budget` exists and is granted to admin, project-manager and operation, not to accountant.
- Column kind backfill: `is_done` columns → `done`, "In Progress" → `doing`, others → `todo`; `is_done` follows `kind` on update.
- A task cannot be inserted into a `doing` or `done` column.
- `todo → doing` fails without `initial_cost`, succeeds with it and stamps `started_at`.
- `doing → done` fails without `final_cash`, fails while a sub-task is not done, and succeeds otherwise: it stamps `finished_at` and creates exactly one `task_final` ledger row; finishing again or editing `final_cash` updates that row instead of adding one; reopening deletes it; `final_cash = 0` posts nothing.
- `todo → done` is refused.
- A delegate group member with `task.budget` can start the task. A board member without `task.budget` cannot start, finish, or write `task_budgets`. A non-author delegate cannot change `planned_cash`.
- A board member with neither `task.budget` nor `finance.read` selects zero `task_budgets` rows; `finance.manage` sees all.
- Sub-task of a sub-task, cross-board parent, and self-parent are rejected; delegation to a non-member user or a group not on the board is rejected; a non-author non-owner cannot change delegation.
- The start/finish `activity_log` rows contain no amounts.

**M13**
- a ≤ m ≤ b enforced; partial estimates rejected; zeros allowed.
- A link across boards, a self-link and a 2- or 3-node cycle are rejected; a diamond (A→B, A→C, B→D, C→D) is accepted.
- A non-member reads and writes no links; deleting a task removes its links.

After both migrations: `supabase db reset` clean, `supabase test db` green, `bun run db:types` committed (C-11).
