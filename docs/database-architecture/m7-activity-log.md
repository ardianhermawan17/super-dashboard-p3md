# M7 · Activity log

> **Scope:** the trigger-fed read model that agents and the digest summarize.
> Consumers: [agent-layer-mcp.md](../backend-architecture/agent-layer-mcp.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

```sql
create table public.activity_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  entity_type text not null check (entity_type in ('task', 'message', 'event', 'candidate')),
  entity_id uuid not null,
  verb text not null,                -- created | moved | updated | deleted | sent | failed
  summary text not null,             -- one human sentence, NO personal data
  board_id uuid,
  role_id uuid,
  group_id uuid,
  meta jsonb not null default '{}'::jsonb
);
create index on public.activity_log (occurred_at desc);
create index on public.activity_log (entity_type, entity_id);

alter table public.activity_log enable row level security;

-- Visible when you could see the underlying thing. No insert policy: only triggers write.
create policy "activity follows entity visibility" on public.activity_log for select to authenticated using (
  actor_id = (select auth.uid())
  or (board_id is not null and public.is_board_member(board_id))
  or (role_id is not null and role_id in (select public.my_role_ids()))
  or (group_id is not null and group_id in (select public.my_group_ids()))
  or (entity_type = 'event' and public.can_see_event(entity_id))
);

create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_verb text; v_summary text;
begin
  if tg_op = 'DELETE' then
    insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary, board_id)
    values ((select auth.uid()), 'task', old.id, 'deleted', format('Task "%s" deleted', old.title), old.board_id);
    return old;
  end if;

  if tg_op = 'INSERT' then
    v_verb := 'created';
    v_summary := format('Task "%s" created', new.title);
  elsif new.column_id is distinct from old.column_id then
    v_verb := 'moved';
    v_summary := format('Task "%s" moved to %s', new.title,
                        (select title from public.board_columns where id = new.column_id));
  elsif (new.title, new.description, new.priority, new.assignee_id, new.due_date)
        is not distinct from (old.title, old.description, old.priority, old.assignee_id, old.due_date) then
    return new;                                   -- reorder within a column: not news
  else
    v_verb := 'updated';
    v_summary := format('Task "%s" updated', new.title);
  end if;

  insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary, board_id)
  values ((select auth.uid()), 'task', new.id, v_verb, v_summary, new.board_id);
  return new;
end $$;
create trigger tasks_activity after insert or update or delete on public.tasks
  for each row execute function public.log_task_activity();

create or replace function public.log_message_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('sent', 'failed') and old.status is distinct from new.status then
    insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary, role_id, group_id)
    values (new.sender_id, 'message', new.id, new.status::text,
            format('Mail "%s" %s to %s', new.subject, new.status,
                   coalesce((select slug from public.roles where id = new.to_role_id),
                            'group:' || (select slug from public.groups where id = new.to_group_id))),
            new.to_role_id, new.to_group_id);
  end if;
  return new;
end $$;
create trigger messages_activity after update of status on public.messages
  for each row execute function public.log_message_activity();

create or replace function public.log_event_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'app' then
    insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary)
    values ((select auth.uid()), 'event', new.id,
            case when tg_op = 'INSERT' then 'created' else 'updated' end,
            format('Event "%s" on %s', new.title,
                   to_char(new.starts_at at time zone 'Asia/Jakarta', 'DD Mon HH24:MI "WIB"')));
  end if;
  return new;
end $$;
create trigger events_activity after insert or update on public.events
  for each row execute function public.log_event_activity();

-- Keep the free-tier database small.
select cron.schedule('activity-retention', '30 20 * * *',
  $$ delete from public.activity_log where occurred_at < now() - interval '180 days' $$);
```
