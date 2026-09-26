-- Migration M5 · Kanban
-- Scope: boards, board_members, board_groups, board_columns, tasks, is_board_member, is_board_owner, add_creator_as_member, notify_task_assignee, realtime

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (board_id, user_id)
);

create table if not exists public.board_groups (
  board_id uuid not null references public.boards(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (board_id, group_id)
);

create table if not exists public.board_columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  position text collate "C" not null,           -- fractional index; "C" = JS string order
  is_done boolean not null default false         -- tasks here are never "overdue"
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  column_id uuid not null references public.board_columns(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assignee_id uuid references auth.users(id),
  due_date date,
  position text collate "C" not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_board_col_pos on public.tasks (board_id, column_id, position);
create index if not exists idx_board_columns_board_pos on public.board_columns (board_id, position);
create index if not exists idx_board_members_user on public.board_members (user_id);
create index if not exists idx_board_groups_group on public.board_groups (group_id);

alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_groups enable row level security;
alter table public.board_columns enable row level security;
alter table public.tasks enable row level security;

create or replace function public.is_board_member(p_board uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.board_members where board_id = p_board and user_id = (select auth.uid()))
      or exists (select 1 from public.board_groups
                  where board_id = p_board and group_id in (select public.my_group_ids()));
$$;

create or replace function public.is_board_owner(p_board uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.boards where id = p_board and created_by = (select auth.uid()));
$$;

-- Boards RLS policies
create policy "boards visible to members" on public.boards for select to authenticated
  using (public.is_board_member(id) or created_by = (select auth.uid()));

create policy "boards created with permission" on public.boards for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.has_permission('kanban.write')));

create policy "boards edited by owner" on public.boards for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

create policy "boards deleted by owner" on public.boards for delete to authenticated
  using (created_by = (select auth.uid()));

-- Board Members RLS policies
create policy "members visible to members" on public.board_members for select to authenticated
  using (public.is_board_member(board_id));

create policy "members managed by owner" on public.board_members for all to authenticated
  using (public.is_board_owner(board_id)) with check (public.is_board_owner(board_id));

-- Board Groups RLS policies
create policy "board groups visible to members" on public.board_groups for select to authenticated
  using (public.is_board_member(board_id));

create policy "board groups managed by owner" on public.board_groups for all to authenticated
  using (public.is_board_owner(board_id)) with check (public.is_board_owner(board_id));

-- Board Columns RLS policies
create policy "columns via membership" on public.board_columns for all to authenticated
  using (public.is_board_member(board_id)) with check (public.is_board_member(board_id));

-- Tasks RLS policies
create policy "tasks via membership" on public.tasks for all to authenticated
  using (public.is_board_member(board_id)) with check (public.is_board_member(board_id));

-- Board creator becomes a member automatically.
create or replace function public.add_creator_as_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.board_members (board_id, user_id) values (new.id, new.created_by) on conflict do nothing;
  return new;
end $$;

drop trigger if exists boards_add_creator on public.boards;
create trigger boards_add_creator after insert on public.boards
  for each row execute function public.add_creator_as_member();

-- Assignment → notification (never for self-assignment).
create or replace function public.notify_task_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assignee_id is null or new.assignee_id = (select auth.uid()) then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.assignee_id is not distinct from old.assignee_id then
      return new;
    end if;
  end if;
  perform public.notify(array[new.assignee_id], 'task.assigned', format('Assigned: %s', new.title), null,
                        '/dashboard/kanban/' || new.board_id || '?task=' || new.id);
  return new;
end $$;

drop trigger if exists tasks_notify_assignee on public.tasks;
create trigger tasks_notify_assignee after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_assignee();

alter publication supabase_realtime add table public.tasks, public.board_columns;
