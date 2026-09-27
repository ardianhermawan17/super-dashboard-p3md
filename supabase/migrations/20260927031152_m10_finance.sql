-- PSI-101 · Migration M10: finance (event cashflow) and the event ↔ board link
-- Spec: docs/database-architecture/m10-finance.md
-- Human approvals (C-15), operator, 2026-09-27:
--   * new permission keys finance.read / finance.write / finance.manage (granted to admin);
--   * the activity_log select policy gains a finance rule (finance rows carry no board_id,
--     so board members without finance.read never see amounts in the feed, digests or agents).

-- ============================================================================
-- 1. Permissions (C-17: a new gate is a new key, granted to admin in the same migration)
-- ============================================================================
insert into public.permissions (key, module, description) values
  ('finance.read',   'finance', 'See income and spending on boards you belong to'),
  ('finance.write',  'finance', 'Record, edit and delete income and spending on boards you belong to'),
  ('finance.manage', 'finance', 'Manage finance categories and see every ledger')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join (values ('finance.read'), ('finance.write'), ('finance.manage')) as p(key)
where r.slug = 'admin'
on conflict do nothing;

-- ============================================================================
-- 2. Event ↔ board link: one board per event; boards without an event stay valid
-- ============================================================================
alter table public.boards add column if not exists event_id uuid references public.events(id) on delete set null;
create unique index if not exists idx_boards_event on public.boards (event_id) where event_id is not null;

-- ============================================================================
-- 3. Categories
-- ============================================================================
create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(name) between 1 and 60),
  direction text check (direction in ('inflow', 'outflow')),   -- null = usable for both
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),               -- for charts
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.finance_categories (slug, name, direction) values
  ('sponsorship', 'Sponsorship', 'inflow'),
  ('ticketing', 'Ticketing', 'inflow'),
  ('donation', 'Donation', 'inflow'),
  ('membership-fee', 'Membership fee', 'inflow'),
  ('venue', 'Venue', 'outflow'),
  ('catering', 'Catering', 'outflow'),
  ('transport', 'Transport', 'outflow'),
  ('equipment', 'Equipment', 'outflow'),
  ('honorarium', 'Honorarium', 'outflow'),
  ('marketing', 'Marketing', 'outflow'),
  ('other', 'Other', null)
on conflict (slug) do nothing;

-- ============================================================================
-- 4. Entries: every entry sits on a board; event and task are optional links
-- ============================================================================
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  category_id uuid not null references public.finance_categories(id),
  direction text not null check (direction in ('inflow', 'outflow')),
  amount numeric(16,2) not null check (amount > 0),              -- sign lives in direction
  currency text not null default 'IDR' check (currency = 'IDR'),
  occurred_on date not null default (now() at time zone 'Asia/Jakarta')::date,
  description text not null check (length(description) between 1 and 300),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_finance_entries_board_date on public.finance_entries (board_id, occurred_on desc);
create index if not exists idx_finance_entries_event on public.finance_entries (event_id) where event_id is not null;
create index if not exists idx_finance_entries_task on public.finance_entries (task_id) where task_id is not null;
create index if not exists idx_finance_entries_category on public.finance_entries (category_id);

-- Cross-row rules a check constraint cannot express. The event follows the board: on insert a board
-- linked to an event stamps that event and an unlinked board allows none; moving an entry to another
-- board takes that board's event. Other updates may clear event_id (that is how ON DELETE SET NULL
-- from events arrives) but never point it at a different event.
create or replace function public.finance_entry_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_board_event uuid;
  v_cat_direction text;
  v_cat_archived boolean;
begin
  select b.event_id into v_board_event from public.boards b where b.id = new.board_id;

  if new.task_id is not null
     and (tg_op = 'INSERT' or new.task_id is distinct from old.task_id or new.board_id is distinct from old.board_id)
     and not exists (select 1 from public.tasks t where t.id = new.task_id and t.board_id = new.board_id) then
    raise exception 'finance entry: task % is not on board %', new.task_id, new.board_id using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.board_id is distinct from old.board_id then
    new.event_id := v_board_event;               -- moved to another board: the event follows it
  elsif tg_op = 'INSERT' then
    if v_board_event is not null then
      if new.event_id is null then
        new.event_id := v_board_event;
      elsif new.event_id <> v_board_event then
        raise exception 'finance entry: event % does not match the board''s event', new.event_id using errcode = '23514';
      end if;
    elsif new.event_id is not null then
      raise exception 'finance entry: board % is not linked to an event', new.board_id using errcode = '23514';
    end if;
  elsif new.event_id is not null and new.event_id is distinct from old.event_id
        and new.event_id is distinct from v_board_event then
    raise exception 'finance entry: event % does not match the board''s event', new.event_id using errcode = '23514';
  end if;

  select c.direction, c.archived into v_cat_direction, v_cat_archived
  from public.finance_categories c where c.id = new.category_id;
  if v_cat_direction is not null and v_cat_direction <> new.direction then
    raise exception 'finance entry: category is for % only', v_cat_direction using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if v_cat_archived then
      raise exception 'finance entry: category is archived' using errcode = '23514';
    end if;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists finance_entries_guard on public.finance_entries;
create trigger finance_entries_guard
  before insert or update on public.finance_entries
  for each row execute function public.finance_entry_guard();

-- ============================================================================
-- 5. RLS: a finance permission AND membership of the board (users or groups, M5)
-- ============================================================================
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

drop policy if exists "categories readable by finance users" on public.finance_categories;
create policy "categories readable by finance users" on public.finance_categories
  for select to authenticated
  using ((select public.has_permission('finance.read'))
      or (select public.has_permission('finance.write'))
      or (select public.has_permission('finance.manage')));

drop policy if exists "categories managed" on public.finance_categories;
create policy "categories managed" on public.finance_categories
  for all to authenticated
  using ((select public.has_permission('finance.manage')))
  with check ((select public.has_permission('finance.manage')));

drop policy if exists "entries readable" on public.finance_entries;
create policy "entries readable" on public.finance_entries
  for select to authenticated using (public.can_read_finance(board_id));

drop policy if exists "entries inserted" on public.finance_entries;
create policy "entries inserted" on public.finance_entries
  for insert to authenticated
  with check (public.can_write_finance(board_id) and created_by = (select auth.uid()));

drop policy if exists "entries updated" on public.finance_entries;
create policy "entries updated" on public.finance_entries
  for update to authenticated
  using (public.can_write_finance(board_id)) with check (public.can_write_finance(board_id));

drop policy if exists "entries deleted" on public.finance_entries;
create policy "entries deleted" on public.finance_entries
  for delete to authenticated using (public.can_write_finance(board_id));

-- ============================================================================
-- 6. Activity log (M7): finance rows carry no board_id and follow finance visibility only
-- ============================================================================
alter table public.activity_log drop constraint if exists activity_log_entity_type_check;
alter table public.activity_log add constraint activity_log_entity_type_check
  check (entity_type in ('task', 'message', 'event', 'candidate', 'finance'));

-- RLS change on an existing table (C-15, approved): finance rows use can_read_finance exclusively,
-- including for their own actor; every other entity type keeps the M7 rules unchanged.
drop policy if exists "activity follows entity visibility" on public.activity_log;
create policy "activity follows entity visibility" on public.activity_log
  for select to authenticated using (
    case
      when entity_type = 'finance' then public.can_read_finance((meta->>'board_id')::uuid)
      else (
        actor_id = (select auth.uid())
        or (board_id is not null and public.is_board_member(board_id))
        or (role_id is not null and role_id in (select public.my_role_ids()))
        or (group_id is not null and group_id in (select public.my_group_ids()))
        or (entity_type = 'event' and public.can_see_event(entity_id))
      )
    end
  );

create or replace function public.log_finance_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r public.finance_entries;
  v_verb text;
  v_board text;
  v_category text;
  v_slug text;
begin
  if tg_op = 'DELETE' then
    r := old; v_verb := 'deleted';
  elsif tg_op = 'INSERT' then
    r := new; v_verb := 'created';
  else
    r := new; v_verb := 'updated';
  end if;

  select b.name into v_board from public.boards b where b.id = r.board_id;
  select c.name, c.slug into v_category, v_slug from public.finance_categories c where c.id = r.category_id;

  -- One human sentence, no names or personal data (M7 rule).
  insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary, meta)
  values (
    (select auth.uid()), 'finance', r.id, v_verb,
    format('%s of Rp %s %s (%s) on %s',
           initcap(r.direction),
           replace(to_char(trunc(r.amount), 'FM999,999,999,999,990'), ',', '.'),
           v_verb, coalesce(v_category, 'uncategorised'), coalesce(v_board, 'a board')),
    jsonb_build_object(
      'board_id', r.board_id, 'event_id', r.event_id, 'task_id', r.task_id,
      'direction', r.direction, 'amount', r.amount::text, 'currency', r.currency, 'category', v_slug)
  );
  return null; -- AFTER trigger: return value ignored
end $$;

drop trigger if exists finance_entries_activity on public.finance_entries;
create trigger finance_entries_activity
  after insert or update or delete on public.finance_entries
  for each row execute function public.log_finance_activity();

-- ============================================================================
-- 7. Agent view (M8 pattern): runs as the caller, so the RLS above applies
-- ============================================================================
create or replace view public.agent_finance
with (security_invoker = true) as
select
  f.board_id,
  b.name as board,
  f.event_id,
  e.title as event,
  e.starts_at as event_starts_at,
  f.direction,
  c.slug as category,
  c.name as category_name,
  f.currency,
  count(*) as entry_count,
  sum(f.amount) as total,
  min(f.occurred_on) as first_on,
  max(f.occurred_on) as last_on
from public.finance_entries f
join public.boards b on b.id = f.board_id
join public.finance_categories c on c.id = f.category_id
left join public.events e on e.id = f.event_id
group by f.board_id, b.name, f.event_id, e.title, e.starts_at, f.direction, c.slug, c.name, f.currency;

grant select on public.agent_finance to authenticated;
