-- PSI-070 · Migration M7: Activity log
-- Read model fed by triggers for agent consumption, digests, and audit tracking.
-- Spec: docs/database-architecture/m7-activity-log.md

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (entity_type in ('task', 'message', 'event', 'candidate')),
  entity_id uuid not null,
  verb text not null,                -- created | moved | updated | deleted | sent | failed
  summary text not null,             -- one human sentence, NO personal data
  board_id uuid references public.boards(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_activity_log_occurred_at on public.activity_log (occurred_at desc);
create index if not exists idx_activity_log_entity on public.activity_log (entity_type, entity_id);
create index if not exists idx_activity_log_board on public.activity_log (board_id) where board_id is not null;
create index if not exists idx_activity_log_role on public.activity_log (role_id) where role_id is not null;
create index if not exists idx_activity_log_group on public.activity_log (group_id) where group_id is not null;

alter table public.activity_log enable row level security;

-- Visible when you could see the underlying thing. No insert policy: only triggers/security definers write.
drop policy if exists "activity follows entity visibility" on public.activity_log;
create policy "activity follows entity visibility" on public.activity_log
  for select to authenticated using (
    actor_id = (select auth.uid())
    or (board_id is not null and public.is_board_member(board_id))
    or (role_id is not null and role_id in (select public.my_role_ids()))
    or (group_id is not null and group_id in (select public.my_group_ids()))
    or (entity_type = 'event' and public.can_see_event(entity_id))
  );

-- ============================================================================
-- Triggers
-- ============================================================================

-- 1. Tasks activity trigger
create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_verb text;
  v_summary text;
  v_actor uuid;
begin
  v_actor := (select auth.uid());

  if tg_op = 'DELETE' then
    insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary, board_id)
    values (v_actor, 'task', old.id, 'deleted', format('Task "%s" deleted', old.title), old.board_id);
    return old;
  end if;

  if tg_op = 'INSERT' then
    v_verb := 'created';
    v_summary := format('Task "%s" created', new.title);
  elsif new.column_id is distinct from old.column_id then
    v_verb := 'moved';
    v_summary := format('Task "%s" moved to %s', new.title,
                        coalesce((select title from public.board_columns where id = new.column_id), 'another column'));
  elsif (new.title, new.description, new.priority, new.assignee_id, new.due_date)
        is not distinct from (old.title, old.description, old.priority, old.assignee_id, old.due_date) then
    return new; -- reorder within a column (position change only): not news
  else
    v_verb := 'updated';
    v_summary := format('Task "%s" updated', new.title);
  end if;

  insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary, board_id)
  values (v_actor, 'task', new.id, v_verb, v_summary, new.board_id);
  return new;
end $$;

drop trigger if exists tasks_activity on public.tasks;
create trigger tasks_activity
  after insert or update or delete on public.tasks
  for each row execute function public.log_task_activity();

-- 2. Messages activity trigger
create or replace function public.log_message_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_target text;
begin
  if new.status in ('sent', 'failed') and old.status is distinct from new.status then
    if new.to_role_id is not null then
      v_target := coalesce((select slug from public.roles where id = new.to_role_id), 'role');
    elsif new.to_group_id is not null then
      v_target := 'group:' || coalesce((select slug from public.groups where id = new.to_group_id), 'group');
    else
      v_target := 'recipients';
    end if;

    insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary, role_id, group_id)
    values (
      new.sender_id,
      'message',
      new.id,
      new.status::text,
      format('Mail "%s" %s to %s', new.subject, new.status, v_target),
      new.to_role_id,
      new.to_group_id
    );
  end if;
  return new;
end $$;

drop trigger if exists messages_activity on public.messages;
create trigger messages_activity
  after update of status on public.messages
  for each row execute function public.log_message_activity();

-- 3. Events activity trigger
create or replace function public.log_event_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid;
begin
  -- Only log app-created events, ignore external Google imports to avoid noise/cycles
  if new.source = 'app' then
    v_actor := (select auth.uid());
    insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary)
    values (
      v_actor,
      'event',
      new.id,
      case when tg_op = 'INSERT' then 'created' else 'updated' end,
      format('Event "%s" on %s', new.title,
             to_char(new.starts_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI "WIB"'))
    );
  end if;
  return new;
end $$;

drop trigger if exists events_activity on public.events;
create trigger events_activity
  after insert or update on public.events
  for each row execute function public.log_event_activity();

-- ============================================================================
-- Retention Job (180 days)
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('activity-retention');
    perform cron.schedule(
      'activity-retention',
      '30 20 * * *',
      $cron$ delete from public.activity_log where occurred_at < now() - interval '180 days' $cron$
    );
  end if;
exception
  when others then null;
end $$;
