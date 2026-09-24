# M4 · Calendar

> **Scope:** events, audiences (user, role or group), invite notifications, the ICS feed helpers.
> UI: [calendar.md](../frontend-architecture/features/calendar.md) · Google sync: [google-integration.md](../backend-architecture/google-integration.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

Audience is a user, a role or a group. `source` separates app events from events imported from Google (M6); imported events have no app owner, so nobody can edit them in the app.

```sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  rrule text,                                     -- RRULE value without the "RRULE:" prefix
  source text not null default 'app' check (source in ('app', 'google')),
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at),
  check (source = 'google' or created_by is not null)
);
create index on public.events (starts_at);

create table public.event_audience (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  check (num_nonnulls(user_id, role_id, group_id) = 1)
);
create unique index on public.event_audience (event_id, user_id) where user_id is not null;
create unique index on public.event_audience (event_id, role_id) where role_id is not null;
create unique index on public.event_audience (event_id, group_id) where group_id is not null;

alter table public.events enable row level security;
alter table public.event_audience enable row level security;

create or replace function public.can_see_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event and e.created_by = (select auth.uid()))
      or exists (select 1 from public.event_audience a
                  where a.event_id = p_event
                    and (a.user_id = (select auth.uid())
                         or a.role_id in (select public.my_role_ids())
                         or a.group_id in (select public.my_group_ids())));
$$;

create or replace function public.is_event_creator(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events where id = p_event and created_by = (select auth.uid()));
$$;

create policy "events visible to creator and audience" on public.events for select to authenticated
  using (public.can_see_event(id));
create policy "events created with permission" on public.events for insert to authenticated
  with check (created_by = (select auth.uid()) and source = 'app'
              and (select public.has_permission('calendar.write')));
create policy "events edited by creator" on public.events for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "events deleted by creator" on public.events for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "audience visible with event" on public.event_audience for select to authenticated
  using (public.can_see_event(event_id));
create policy "audience managed by creator" on public.event_audience for all to authenticated
  using (public.is_event_creator(event_id)) with check (public.is_event_creator(event_id));

-- Audience resolved to people (triggers, ICS, Google push). Service side only.
create or replace function public.event_audience_user_ids(p_event uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select a.user_id from public.event_audience a
   where a.event_id = p_event and a.user_id is not null
  union
  select gm.user_id from public.event_audience a
    join public.group_members gm on gm.group_id = a.group_id
   where a.event_id = p_event
  union
  select p.id from public.profiles p
   where p.status = 'active'
     and exists (select 1 from public.event_audience a
                  where a.event_id = p_event and a.role_id is not null
                    and a.role_id in (select public.effective_role_ids(p.id)));
$$;
revoke execute on function public.event_audience_user_ids(uuid) from public, anon, authenticated;
grant execute on function public.event_audience_user_ids(uuid) to service_role;

-- Invitations: one notification batch per insert statement. Imported Google events never notify.
-- Adding audience rows later re-notifies the whole audience of that event (acceptable in v1).
create or replace function public.notify_event_invites()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select distinct e.id, e.title, e.starts_at, e.created_by
             from new_rows n join public.events e on e.id = n.event_id
            where e.source = 'app' loop
    perform public.notify(
      array(select u from public.event_audience_user_ids(r.id) u where u is distinct from r.created_by),
      'event.invited',
      format('Invitation: %s', r.title),
      to_char(r.starts_at at time zone 'Asia/Jakarta', 'Dy DD Mon HH24:MI "WIB"'),
      '/dashboard/calendar?event=' || r.id);
  end loop;
  return null;
end $$;
create trigger event_audience_invites after insert on public.event_audience
  referencing new table as new_rows for each statement execute function public.notify_event_invites();

create or replace function public.notify_event_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'app'
     and (new.starts_at, new.ends_at, new.location) is distinct from (old.starts_at, old.ends_at, old.location) then
    perform public.notify(
      array(select u from public.event_audience_user_ids(new.id) u where u is distinct from (select auth.uid())),
      'event.updated',
      format('Changed: %s', new.title),
      to_char(new.starts_at at time zone 'Asia/Jakarta', 'Dy DD Mon HH24:MI "WIB"'),
      '/dashboard/calendar?event=' || new.id);
  end if;
  return new;
end $$;
create trigger events_notify_update after update on public.events
  for each row execute function public.notify_event_update();

-- ICS feed (PSI-044): one secret token per user.
create table public.calendar_feed_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.calendar_feed_tokens enable row level security;
create policy "own feed token" on public.calendar_feed_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Same visibility rule as can_see_event, by explicit user id (the ICS route has no JWT).
create or replace function public.events_for_user(p_user uuid, p_from timestamptz, p_to timestamptz)
returns setof public.events
language sql stable security definer set search_path = '' as $$
  select e.* from public.events e
   where ((e.starts_at < p_to and e.ends_at > p_from) or e.rrule is not null)
     and (e.created_by = p_user
          or exists (select 1 from public.event_audience a
                      where a.event_id = e.id
                        and (a.user_id = p_user
                             or a.role_id in (select public.effective_role_ids(p_user))
                             or a.group_id in (select gm.group_id from public.group_members gm
                                                where gm.user_id = p_user))));
$$;
revoke execute on function public.events_for_user(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.events_for_user(uuid, timestamptz, timestamptz) to service_role;
```
