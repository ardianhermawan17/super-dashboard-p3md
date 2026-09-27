# M10 · Finance (event cashflow)

> **Scope:** income and spending ("inflow" / "outflow") with categories, tied to the event → board → task chain; the event ↔ board link; finance permissions; activity logging; the agent view.
> UI: [features/finance.md](../frontend-architecture/features/finance.md) · Agent tool: [agent-layer-mcp.md](../backend-architecture/agent-layer-mcp.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)
> Tasks: PSI-100 (this design) → PSI-101 (migration) → PSI-102 … PSI-106.

## The streamline this serves

```
events (M4)  ──event_id──▶  boards (M5)  ──board_id──▶  finance_entries (M10)
  17-08-2026                 "Event President"            Rp 2.000.000 outflow · Venue
  audience: groups ─copied─▶ board_groups                 Rp 1.200.000 inflow  · Sponsorship
                             tasks ◀──────task_id──────── (optional: the task that caused it)
```

An event gets a board; the board's **groups** decide who works on it (existing M5 RBAC); the same membership plus a `finance.*` permission decides who sees and records its money. No new sharing model.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Amount | `numeric(16,2)`, always `> 0`; sign lives in `direction` (`inflow` / `outflow`) | Exact money (no float); no "is −2.000.000 an outflow or a refund?" ambiguity for people or LLMs |
| Currency | `currency text default 'IDR' check (currency = 'IDR')` | One currency today; the column makes a later multi-currency change additive |
| Date | `occurred_on date` (WIB calendar day) + `created_at timestamptz` | Cashflow is booked per day; audit time stays exact |
| Scope | Every entry belongs to a **board** (`board_id not null`); `event_id` and `task_id` optional and must match the board | Reuses board membership for RBAC; an organisation-wide ledger is simply a board without an event |
| Categories | Table, not enum; stable `slug`; optional `direction` restriction | Admins add categories without a migration; agents filter by slug |
| Delete | Hard delete, recorded in `activity_log` (verb `deleted`, amount in `meta`) | Operator asked for CRUD; the log keeps the trail |
| Permissions | `finance.read`, `finance.write`, `finance.manage` (+ granted to `admin`) | Approved by the operator on 2026-09-27 (C-15, quoted in the PSI-100 history entry) |

## Schema (sketch for PSI-101)

```sql
-- 1. Permissions (C-17: new gates = new keys, granted to admin in the same migration)
insert into public.permissions (key, module, description) values
  ('finance.read',   'finance', 'See income and spending on boards you belong to'),
  ('finance.write',  'finance', 'Record, edit and delete income and spending on boards you belong to'),
  ('finance.manage', 'finance', 'Manage finance categories and see every ledger')
on conflict (key) do nothing;
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r
cross join (values ('finance.read'), ('finance.write'), ('finance.manage')) as p(key)
where r.slug = 'admin'
on conflict do nothing;

-- 2. Event ↔ board link (one board per event; boards without an event stay valid)
alter table public.boards add column if not exists event_id uuid references public.events(id) on delete set null;
create unique index if not exists idx_boards_event on public.boards (event_id) where event_id is not null;

-- 3. Categories
create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  direction text check (direction in ('inflow', 'outflow')),   -- null = usable for both
  color text,                                                   -- hex, for charts
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.finance_categories (slug, name, direction) values
  ('sponsorship', 'Sponsorship', 'inflow'), ('ticketing', 'Ticketing', 'inflow'),
  ('donation', 'Donation', 'inflow'), ('membership-fee', 'Membership fee', 'inflow'),
  ('venue', 'Venue', 'outflow'), ('catering', 'Catering', 'outflow'),
  ('transport', 'Transport', 'outflow'), ('equipment', 'Equipment', 'outflow'),
  ('honorarium', 'Honorarium', 'outflow'), ('marketing', 'Marketing', 'outflow'),
  ('other', 'Other', null)
on conflict (slug) do nothing;

-- 4. Entries
create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  category_id uuid not null references public.finance_categories(id),
  direction text not null check (direction in ('inflow', 'outflow')),
  amount numeric(16,2) not null check (amount > 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  occurred_on date not null default (now() at time zone 'Asia/Jakarta')::date,
  description text not null check (length(description) between 1 and 300),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.finance_entries (board_id, occurred_on desc);
create index on public.finance_entries (event_id) where event_id is not null;
create index on public.finance_entries (task_id) where task_id is not null;
```

A `before insert or update` trigger enforces the cross-row rules the checks cannot: `task_id` belongs to `board_id`; `event_id` equals the board's `event_id` when the board has one; the category's `direction` (if set) matches; `updated_at = now()` on update.

## RLS

```sql
alter table public.finance_categories enable row level security;
alter table public.finance_entries enable row level security;

create or replace function public.can_read_finance(p_board uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select public.has_permission('finance.manage'))
      or ((select public.has_permission('finance.read')) and public.is_board_member(p_board));
$$;

create or replace function public.can_write_finance(p_board uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select public.has_permission('finance.manage'))
      or ((select public.has_permission('finance.write')) and public.is_board_member(p_board));
$$;

create policy "categories readable by finance users" on public.finance_categories for select to authenticated
  using ((select public.has_permission('finance.read')) or (select public.has_permission('finance.write'))
      or (select public.has_permission('finance.manage')));
create policy "categories managed" on public.finance_categories for all to authenticated
  using ((select public.has_permission('finance.manage'))) with check ((select public.has_permission('finance.manage')));

create policy "entries readable" on public.finance_entries for select to authenticated
  using (public.can_read_finance(board_id));
create policy "entries inserted" on public.finance_entries for insert to authenticated
  with check (public.can_write_finance(board_id) and created_by = (select auth.uid()));
create policy "entries updated" on public.finance_entries for update to authenticated
  using (public.can_write_finance(board_id)) with check (public.can_write_finance(board_id));
create policy "entries deleted" on public.finance_entries for delete to authenticated
  using (public.can_write_finance(board_id));
```

`finance.write` does not imply read in SQL: a writer without `finance.read` can insert an entry but cannot read the row back (so no `insert ... returning`). Writers can still list categories (the select policy accepts `finance.write`) so they can pick one. Roles that write should also hold `finance.read` (seed both for a "treasurer" role in `seed.sql`, fake data only, C-07).

## Activity log (M7) — must not leak amounts

`activity_log` shows a row to every board member when `board_id` is set. Finance rows must **not** set `board_id`, or members without `finance.read` would see amounts in the feed, digests and agent answers. PSI-101 therefore:

1. Replaces the `entity_type` check with one that adds `'finance'` (new migration, never edit M7, C-06).
2. Logs `finance` rows with `board_id = null` and `meta = {board_id, event_id, task_id, direction, amount, category}`; `summary` like `"Outflow Rp 2.000.000 (Venue) on Event President"`: no names, no personal data.
3. Adds one branch to the select policy: `or (entity_type = 'finance' and public.can_read_finance((meta->>'board_id')::uuid))`.

This is an RLS change on an existing table: the PR must call it out for human review (C-15).

## Agent view (M8 pattern)

```sql
create or replace view public.agent_finance
with (security_invoker = true) as          -- runs as the caller: RLS above applies
select
  f.board_id, b.name as board, f.event_id, e.title as event, e.starts_at as event_starts_at,
  f.direction, c.slug as category, c.name as category_name, f.currency,
  count(*) as entry_count, sum(f.amount) as total,
  min(f.occurred_on) as first_on, max(f.occurred_on) as last_on
from public.finance_entries f
join public.boards b on b.id = f.board_id
join public.finance_categories c on c.id = f.category_id
left join public.events e on e.id = f.event_id
group by f.board_id, b.name, f.event_id, e.title, e.starts_at, f.direction, c.slug, c.name, f.currency;
```

Net per board = `sum(total) filter (where direction = 'inflow') − sum(total) filter (where direction = 'outflow')`, computed by the tool, not stored.

## pgTAP (PSI-101 accept)

- A board member with `finance.read` sees the board's entries; a member **without** it sees none; a non-member with `finance.read` sees none; `finance.manage` sees all.
- `finance.write` member can insert/update/delete; an insert with a `task_id` from another board, a mismatched `event_id`, or a category of the wrong direction is rejected.
- `amount <= 0` and `currency <> 'IDR'` are rejected; `anon` reads and writes nothing (schema-wide test from PSI-015 covers the new tables).
- A finance change writes an `activity_log` row that a board member without `finance.read` cannot select.
- `agent_finance` returns only rows the caller can read.
- Deleting an event keeps the board and entries (`event_id` → null); deleting a board removes its entries.
