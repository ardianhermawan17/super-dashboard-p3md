# M6 · Google (Drive mirror, calendar links)

> **Scope:** Drive roots and their access, the file mirror, document view log, linked Google calendars, push triggers, sync schedules.
> Functions: [google-integration.md](../backend-architecture/google-integration.md) · UI: [documents.md](../frontend-architecture/features/documents.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

```sql
create extension if not exists pg_trgm with schema extensions;

-- ============ Drive ============
create table public.drive_roots (
  id uuid primary key default gen_random_uuid(),
  folder_id text not null unique,          -- Drive folder shared with the SA
  name text not null,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table public.drive_root_access (
  root_id uuid not null references public.drive_roots(id) on delete cascade,
  role_id uuid references public.roles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  check (num_nonnulls(role_id, group_id) = 1)
);
create unique index on public.drive_root_access (root_id, role_id) where role_id is not null;
create unique index on public.drive_root_access (root_id, group_id) where group_id is not null;

create table public.drive_files (
  id text primary key,                      -- Google Drive file id
  root_id uuid not null references public.drive_roots(id) on delete cascade,
  parent_id text,
  name text not null,
  mime_type text not null,
  size_bytes bigint,
  modified_at timestamptz,
  path text not null,                       -- "Folder/Sub/file.pdf" for display and search
  web_view_link text,
  synced_at timestamptz not null default now()
);
create index on public.drive_files (root_id, parent_id);
create index drive_files_name_trgm on public.drive_files using gin (name extensions.gin_trgm_ops);

-- Who opened which document (accountability for sensitive folders).
create table public.document_views (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_id text not null,
  viewed_at timestamptz not null default now()
);

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
create table public.google_calendars (
  id uuid primary key default gen_random_uuid(),
  calendar_id text not null unique,        -- e.g. abc123@group.calendar.google.com
  name text not null,
  direction text not null check (direction in ('pull', 'push', 'both')),
  role_id uuid references public.roles(id) on delete cascade,   -- pulled events' audience /
  group_id uuid references public.groups(id) on delete cascade, -- which app events get pushed here
  check (num_nonnulls(role_id, group_id) = 1),
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text
);

create table public.event_google_links (
  event_id uuid not null references public.events(id) on delete cascade,
  google_calendar_id text not null,
  google_event_id text not null,
  html_link text,
  synced_at timestamptz not null default now(),
  primary key (event_id, google_calendar_id),
  unique (google_calendar_id, google_event_id)
);

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

-- Push app events to Google right after they change (async via pg_net, sent after commit).
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
    if old.source = 'app' then           -- BEFORE DELETE: capture links before the cascade removes them
      perform public.internal_post('functions', 'google-calendar/push', jsonb_build_object(
        'event_id', old.id, 'op', 'delete',
        'links', (select coalesce(jsonb_agg(jsonb_build_object(
                   'google_calendar_id', l.google_calendar_id, 'google_event_id', l.google_event_id)), '[]'::jsonb)
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

create trigger events_google_push after insert or update on public.events
  for each row execute function public.queue_google_push_event();
create trigger events_google_delete before delete on public.events
  for each row execute function public.queue_google_push_event();
create trigger audience_google_push after insert or delete on public.event_audience
  for each row execute function public.queue_google_push();

-- Schedules
select cron.schedule('google-drive-sync', '*/30 * * * *',
  $$ select public.internal_post('functions', 'google-drive/sync') $$);
select cron.schedule('google-calendar-sync', '*/15 * * * *',
  $$ select public.internal_post('functions', 'google-calendar/sync') $$);
```

Service-role helpers used by the functions (same migration, `service_role` execute only): `upsert_google_event(...)` (insert or update a pulled event + its link + its audience row in one transaction) and `prune_google_events(p_calendar, p_before, p_from, p_to)` (delete pulled events in the window that were not seen in this run).
