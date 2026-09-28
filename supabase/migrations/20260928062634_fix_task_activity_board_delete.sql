-- PSI-107 · Fix: deleting a board that has tasks fails (M7 task activity trigger)
-- `delete from boards` cascades to `tasks`, firing the tasks_activity DELETE trigger
-- per row. That trigger inserted an activity_log row with board_id = old.board_id,
-- but by the time the cascade reaches tasks, the parent boards row is already gone,
-- so the insert violates activity_log_board_id_fkey. Null the board_id in that case;
-- a live board's task deletes are unaffected.
-- Spec: docs/database-architecture/m7-activity-log.md (do not edit that migration, C-06)

create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_verb text;
  v_summary text;
  v_actor uuid;
  v_board_id uuid;
begin
  v_actor := (select auth.uid());

  if tg_op = 'DELETE' then
    v_board_id := old.board_id;
    if not exists (select 1 from public.boards where id = v_board_id) then
      v_board_id := null; -- board is being deleted in the same cascade; it no longer exists
    end if;

    insert into public.activity_log (actor_id, entity_type, entity_id, verb, summary, board_id)
    values (v_actor, 'task', old.id, 'deleted', format('Task "%s" deleted', old.title), v_board_id);
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
