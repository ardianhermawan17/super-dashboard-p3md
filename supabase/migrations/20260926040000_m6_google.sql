-- Migration M6 · Google (Drive mirror, calendar links)
-- Scope: drive_roots, drive_root_access, drive_files, document_views, google_calendars,
--        event_google_links, can_see_drive_root, google push triggers, sync schedules,
--        upsert_google_event, prune_google_events.
-- Spec: docs/database-architecture/m6-google.md

create extension if not exists pg_trgm with schema extensions;

-- ============ Drive ============

create table if not exists public.drive_roots (
  id uuid primary key default gen_random_uuid(),
  folder_id text not null unique, -- Drive folder shared with the SA
  name text not null,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.drive_root_access (
  root_id uuid not null references public.drive_roots(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  check (num_nonnulls(role_id, group_id) = 1)
);
create unique index if not exists idx_drive_root_access_role
  on public.drive_root_access (root_id, role_id) where role_id is not null;
create unique index if not exists idx_drive_root_access_group
  on public.drive_root_access (root_id, group_id) where group_id is not null;

create table if not exists public.drive_files (
  id text primary key, -- Google Drive file id
  root_id uuid not null references public.drive_roots(id) on delete cascade,
  parent_id text,
  name text not null,
  mime_type text not null,
  size_bytes bigint,
  modified_at timestamptz,
  path text not null, -- "Folder/Sub/file.pdf" for display and search
  web_view_link text,
  synced_at timestamptz not null default now()
);
create index if not exists idx_drive_files_root_parent on public.drive_files (root_id, parent_id);
create index if not exists drive_files_name_trgm on public.drive_files
  using gin (name extensions.gin_trgm_ops);

-- Who opened which document (accountability for sensitive folders).
create table if not exists public.document_views (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_id text not null,
  viewed_at timestamptz not null default now()
);
create index if not exists idx_document_views_file on public.document_views (file_id, viewed_at desc);

alter table public.drive_roots enable row level security;
alter table public.drive_root_access enable row level security;
alter table public.drive_files enable row level security;
alter table public.document_views enable row level security;

create or replace function public.can_see_drive_root(p_root uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.drive_root_access a
                 where a.root_id = p_root
                 and (a.role_id in (select public.my_role_ids())
                      or a.group_id in (select public.my_group_ids())))
    or (select public.has_permission('documents.manage'));
$$;
revoke execute on function public.can_see_drive_root(uuid) from public, anon;
grant execute on function public.can_see_drive_root(uuid) to authenticated;

create policy "roots visible with access" on public.drive_roots for select to authenticated
  using (public.can_see_drive_root(id));
create policy "roots managed" on public.drive_roots for all to authenticated
  using ((select public.has_permission('integrations.manage')))
  with check ((select public.has_permission('integrations.manage')));

create policy "root access readable" on public.drive_root_access for select to authenticated
  using (public.can_see_drive_root(root_id));
create policy "root access managed" on public.drive_root_access for all to authenticated
  using ((select public.has_permission('documents.manage')))
  with check ((select public.has_permission('documents.manage')));

create policy "files visible with root access" on public.drive_files for select to authenticated
  using (public.can_see_drive_root(root_id));
-- No write policies on drive_files: only google-drive/sync (service role) writes.

create policy "own views loggable" on public.document_views for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "views auditable" on public.document_views for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('documents.manage')));

-- ============ Calendar ============

create table if not exists public.google_calendars (
  id uuid primary key default gen_random_uuid(),
  calendar_id text not null unique, -- e.g. abc123@group.calendar.google.com
  name text not null,
  direction text not null check (direction in ('pull', 'push', 'both')),
  role_id uuid references public.roles(id) on delete cascade, -- pulled events' audience /
  group_id uuid references public.groups(id) on delete cascade, -- which app events get pushed here
  check (num_nonnulls(role_id, group_id) = 1),
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text
);

create table if not exists public.event_google_links (
  event_id uuid not null references public.events(id) on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  html_link text,
  synced_at timestamptz not null default now(),
  primary key (event_id, google_calendar_id),
  unique (google_calendar_id, google_event_id)
);
create index if not exists idx_event_google_links_event on public.event_google_links (event_id);

alter table public.google_calendars enable row level security;
alter table public.event_google_links enable row level security;

create policy "calendars readable" on public.google_calendars for select to authenticated
  using ((select public.has_permission('integrations.manage'))
         or role_id in (select public.my_role_ids()) or group_id in (select public.my_group_ids()));
create policy "calendars managed" on public.google_calendars for all to authenticated
  using ((select public.has_permission('integrations.manage')))
  with check ((select public.has_permission('integrations.manage')));
create policy "links follow event" on public.event_google_links for select to authenticated
  using (public.can_see_event(event_id));

-- ============ Push triggers (async via pg_net, sent after commit) ============

-- Audience changes on an app event mean the pushed Google event's attendee set changed.
create or replace function public.queue_google_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_event uuid := coalesce(new.event_id, old.event_id);
begin
  if (select source from public.events where id = v_event) = 'app' then
    perform public.internal_post('functions', 'google-calendar/push',
      jsonb_build_object('event_id', v_event, 'op', 'upsert'));
  end if;
  return null;
end $$;

create or replace function public.queue_google_push_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.source = 'app' then -- BEFORE DELETE: capture links before the cascade removes them
      perform public.internal_post('functions', 'google-calendar/push', jsonb_build_object(
        'event_id', old.id, 'op', 'delete',
        'links', (select coalesce(jsonb_agg(jsonb_build_object(
          'google_calendar_id', l.google_calendar_id,
          'google_event_id', l.google_event_id)), '[]'::jsonb)
          from public.event_google_links l where l.event_id = old.id)));
    end if;
    return old;
  end if;
  if new.source = 'app' then
    perform public.internal_post('functions', 'google-calendar/push',
      jsonb_build_object('event_id', new.id, 'op', 'upsert'));
  end if;
  return new;
end $$;

drop trigger if exists events_google_push on public.events;
create trigger events_google_push after insert or update on public.events
  for each row execute function public.queue_google_push_event();
drop trigger if exists events_google_delete on public.events;
create trigger events_google_delete before delete on public.events
  for each row execute function public.queue_google_push_event();
drop trigger if exists audience_google_push on public.event_audience;
create trigger audience_google_push after insert or delete on public.event_audience
  for each row execute function public.queue_google_push();

-- ============ Service-role helpers (used by the Edge Functions) ============

-- Insert or update a pulled event + its link + its audience row in one transaction.
create or replace function public.upsert_google_event(
  p_calendar_id text,
  p_google_event_id text,
  p_title text,
  p_description text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_all_day boolean,
  p_rrule text,
  p_html_link text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_event uuid;
  v_cal public.google_calendars%rowtype;
begin
  select * into v_cal from public.google_calendars where calendar_id = p_calendar_id;
  if not found then
    raise exception 'unknown google calendar %', p_calendar_id using errcode = 'no_data_found';
  end if;

  select l.event_id into v_event
  from public.event_google_links l
  where l.google_calendar_id = p_calendar_id and l.google_event_id = p_google_event_id;

  if v_event is null then
    insert into public.events (title, description, location, starts_at, ends_at,
                               all_day, rrule, source, created_by)
    values (p_title, p_description, p_location, p_starts_at, p_ends_at,
            coalesce(p_all_day, false), p_rrule, 'google', null)
    returning id into v_event;
  else
    update public.events
      set title = p_title,
          description = p_description,
          location = p_location,
          starts_at = p_starts_at,
          ends_at = p_ends_at,
          all_day = coalesce(p_all_day, false),
          rrule = p_rrule
      where id = v_event;
  end if;

  insert into public.event_google_links (event_id, google_calendar_id, google_event_id, html_link, synced_at)
  values (v_event, p_calendar_id, p_google_event_id, p_html_link, now())
  on conflict (event_id, google_calendar_id) do update
    set google_event_id = excluded.google_event_id,
        html_link = excluded.html_link,
        synced_at = now();

  -- Audience comes from the linked calendar's role or group (imports never notify, see M4).
  if v_cal.role_id is not null then
    insert into public.event_audience (event_id, role_id) values (v_event, v_cal.role_id)
    on conflict (event_id, role_id) where role_id is not null do nothing;
  elsif v_cal.group_id is not null then
    insert into public.event_audience (event_id, group_id) values (v_event, v_cal.group_id)
    on conflict (event_id, group_id) where group_id is not null do nothing;
  end if;

  return v_event;
end $$;
revoke execute on function public.upsert_google_event(text, text, text, text, text, timestamptz, timestamptz, boolean, text, text) from public, anon, authenticated;
grant execute on function public.upsert_google_event(text, text, text, text, text, timestamptz, timestamptz, boolean, text, text) to service_role;

-- Delete pulled events in the window that were not seen in this run (synced_at < run start).
create or replace function public.prune_google_events(
  p_calendar_id text,
  p_before timestamptz,
  p_from timestamptz,
  p_to timestamptz
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  with stale as (
    select e.id from public.events e
    join public.event_google_links l on l.event_id = e.id
    where l.google_calendar_id = p_calendar_id
      and e.source = 'google'
      and l.synced_at < p_before
      and e.ends_at >= p_from and e.starts_at < p_to
  ), gone as (
    delete from public.events e using stale s where e.id = s.id returning 1
  )
  select count(*) into v_count from gone;
  return coalesce(v_count, 0);
end $$;
revoke execute on function public.prune_google_events(text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.prune_google_events(text, timestamptz, timestamptz, timestamptz) to service_role;

-- ============ Schedules ============

do $outer$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(j.jobname) from cron.job j
      where j.jobname in ('google-drive-sync', 'google-calendar-sync');
    perform cron.schedule('google-drive-sync', '*/30 * * * *',
      $cron$ select public.internal_post('functions', 'google-drive/sync') $cron$);
    perform cron.schedule('google-calendar-sync', '*/15 * * * *',
      $cron$ select public.internal_post('functions', 'google-calendar/sync') $cron$);
  end if;
exception when others then
  null;
end $outer$;
