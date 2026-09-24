# Google Workspace integration: Drive documents and Calendar

> **Scope:** reading and displaying the ~400 documents that live in Google Drive, and syncing the agenda with Google Calendar. Migration M6, Edge Functions `google-drive` and `google-calendar`, the Documents module and Admin → Integrations.
> Gateway: [README_AI_AGENT.md](../README_AI_AGENT.md) · Related: [backend-architecture.md](backend-architecture.md), [rbac-architecture.md](rbac-architecture.md)

## Contents

1. [Decisions](#1-decisions)
2. [Flow](#2-flow)
3. [Google Cloud setup (human, once)](#3-google-cloud-setup-human-once)
4. [Migration M6](#4-migration-m6)
5. [Service-account token helper](#5-service-account-token-helper)
6. [`google-drive` Edge Function](#6-google-drive-edge-function)
7. [`google-calendar` Edge Function](#7-google-calendar-edge-function)
8. [Frontend](#8-frontend)
9. [Talent: CVs in Drive](#9-talent-cvs-in-drive)
10. [Limits and gotchas](#10-limits-and-gotchas)

---

## 1. Decisions

| Question | Decision | Why |
|---|---|---|
| How does the app reach Google? | **One service account (SA)**. Drive folders and Google calendars are *shared with the SA's email* | No per-user OAuth, no refresh tokens to store, no Google app verification for sensitive/restricted scopes, works for Gmail and Workspace alike |
| Where do the 400 documents live? | They stay in Drive. We mirror **metadata only** (`drive_files`) | Supabase free storage is 1 GB; Drive is already the source of truth |
| Can they be displayed on the website? | **Yes.** An Edge Function checks RLS, then streams the file (Google Docs/Sheets/Slides exported to PDF) | Our RBAC decides who sees what, and viewers don't need a Google account or Drive access |
| Who can see which documents? | Access is granted per **Drive root** (a shared folder) to roles and groups | Mirrors how teams already organise folders |
| Search | Name search in Postgres (trigram) + optional full-text search through Drive's own index, filtered by RLS | Drive already indexes PDF and Docs content; no OCR pipeline needed |
| Calendar direction | **Pull** official Google calendars into the agenda (read-only) and **push** app events into linked shared Google calendars | People see everything in the Google Calendar app they already use |
| Invitations & RSVP | Our own (role mail + push notification), not Google's | A service account cannot add attendees without Workspace domain-wide delegation |
| Sync style | Periodic **window rescan** (Drive every 30 min, Calendar every 15 min) + immediate push on app changes | At this scale (hundreds of items) a rescan is a handful of API calls and self-heals; sync tokens/Changes API only if volume grows 10× |

**Upgrade path (not v1):** if Google-native attendee invites and RSVP are required, either use Workspace domain-wide delegation for the SA, or an "integration account" with OAuth and a stored refresh token (publish the OAuth app "In production"; apps left in "Testing" get refresh tokens that expire after 7 days).

## 2. Flow

```
Google Drive folders ──(shared with SA)──┐                 ┌── Google calendars (shared with SA)
                                         ▼                 ▼
                       google-drive/sync (cron 30')   google-calendar/sync (cron 15')  ◀── pull
                                         │                 │
                                         ▼                 ▼
                               drive_files (metadata)   events (source = 'google', read-only)
                                         │
  Browser ──JWT──▶ google-drive/file ── RLS check ──▶ Drive API ──stream──▶ PDF / image in the viewer
  Browser ──JWT──▶ google-drive/search ── Drive fullText ∩ RLS-visible ids

  App event insert/update/delete ──trigger──▶ google-calendar/push ──▶ linked Google calendars   ──▶ push
```

---

## 3. Google Cloud setup (human, once)

PSI-060. Nothing here is automatable by an agent (contract C-15).

1. Google Cloud console → new project `p3md-social` → enable **Google Drive API** and **Google Calendar API**.
2. IAM → Service accounts → create `p3md-sync` → Keys → add JSON key.
   - If key creation is blocked, an org policy (`iam.disableServiceAccountKeyCreation`) is enforced; a Workspace admin must allow it for this project.
3. Store the key as a Supabase secret, base64-encoded, and delete the downloaded file:
   ```bash
   supabase secrets set GOOGLE_SA_KEY_B64="$(base64 -w0 p3md-sync-key.json)"
   ```
4. **Drive:** share each document root folder with the SA email (`p3md-sync@<project>.iam.gserviceaccount.com`) as **Viewer**. For a Shared Drive, add the SA as a member with Viewer.
5. **Calendar:** share each calendar with the SA email:
   - pull-only (e.g. the official program calendar) → "See all event details"
   - push (calendars the app writes to) → "Make changes to events"
6. In the app, Admin → Integrations (`integrations.manage`): add the Drive roots (folder IDs) and calendar IDs, then set which roles/groups can see each (`documents.manage`).

**Scopes used by the SA:** `drive.readonly` and `calendar.events`. Nothing else.

---

## 4. Migration M6

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

---

## 5. Service-account token helper

Signs the SA's JWT with `jose` and exchanges it for an access token; cached per scope for ~1 hour.

```ts
// supabase/functions/_shared/google.ts
import { importPKCS8, SignJWT } from 'npm:jose@5';

type ServiceAccount = { client_email: string; private_key: string };
const sa: ServiceAccount = JSON.parse(atob(Deno.env.get('GOOGLE_SA_KEY_B64')!));
const cache = new Map<string, { token: string; exp: number }>();

export const SCOPES = {
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.events',
};

export async function googleToken(scope: string): Promise<string> {
  const hit = cache.get(scope);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;

  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(await importPKCS8(sa.private_key, 'RS256'));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}`);
  const { access_token, expires_in } = await res.json();
  cache.set(scope, { token: access_token, exp: Date.now() + expires_in * 1000 });
  return access_token;
}

export async function gfetch(scope: string, url: string, init: RequestInit = {}) {
  const token = await googleToken(scope);
  return fetch(url, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
}
```

---

## 6. `google-drive` Edge Function

One function, three routes. `/sync` is called by pg_cron with `INTERNAL_FN_SECRET` (deploy with `--no-verify-jwt` and check the secret yourself); `/file` and `/search` are called by the browser with the user's JWT, which the function checks by querying as that user.

### `/sync`: mirror metadata

```ts
const FOLDER = 'application/vnd.google-apps.folder';
const FIELDS = 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)';

async function listChildren(folderId: string) {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const u = new URL('https://www.googleapis.com/drive/v3/files');
    u.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
    u.searchParams.set('fields', FIELDS);
    u.searchParams.set('pageSize', '1000');
    u.searchParams.set('supportsAllDrives', 'true');
    u.searchParams.set('includeItemsFromAllDrives', 'true');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await gfetch(SCOPES.drive, u.toString());
    if (!res.ok) throw new Error(`drive list ${res.status}`);
    const page = await res.json();
    files.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return files;
}

async function syncRoot(root: { id: string; folder_id: string }) {
  const runStartedAt = new Date().toISOString();
  const rows = [];
  const queue = [{ id: root.folder_id, path: '' }];
  while (queue.length) {                                   // breadth-first walk of the folder tree
    const { id, path } = queue.shift()!;
    for (const f of await listChildren(id)) {
      const p = path ? `${path}/${f.name}` : f.name;
      rows.push({
        id: f.id, root_id: root.id, parent_id: id, name: f.name, mime_type: f.mimeType,
        size_bytes: f.size ? Number(f.size) : null, modified_at: f.modifiedTime,
        path: p, web_view_link: f.webViewLink, synced_at: new Date().toISOString(),
      });
      if (f.mimeType === FOLDER) queue.push({ id: f.id, path: p });
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    await admin.from('drive_files').upsert(rows.slice(i, i + 500));
  }
  // Everything this run saw has synced_at ≥ runStartedAt; the rest was deleted or moved out.
  await admin.from('drive_files').delete().eq('root_id', root.id).lt('synced_at', runStartedAt);
  await admin.from('drive_roots').update({ last_synced_at: runStartedAt, last_error: null }).eq('id', root.id);
}
```

Respond `202` immediately and run the walk inside `EdgeRuntime.waitUntil(...)` so pg_net's short timeout never cuts it off. On error, write `last_error` on the root; the Integrations page shows it.

After a run, emit one `document.added` notification per root that gained files (§4 of the PWA doc).

### `/file?id=<driveFileId>`: display a document

```ts
const EXPORT_AS_PDF = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
]);
const INLINE = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)$/;
const MAX_BYTES = 25 * 1024 * 1024;

// 1. Visibility: query AS THE USER, so RLS decides.
const { data: file } = await asUser
  .from('drive_files').select('id, name, mime_type, size_bytes, web_view_link').eq('id', id).maybeSingle();
if (!file) return json({ error: 'not found' }, 404);
await asUser.from('document_views').insert({ file_id: file.id });

// 2. Fetch from Google with the SA and stream it back.
let upstream: Response;
let contentType = file.mime_type;
if (EXPORT_AS_PDF.has(file.mime_type)) {
  upstream = await gfetch(SCOPES.drive,
    `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=application/pdf`);
  contentType = 'application/pdf';
} else if (INLINE.test(file.mime_type) && (file.size_bytes ?? 0) <= MAX_BYTES) {
  upstream = await gfetch(SCOPES.drive,
    `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`);
} else {
  return json({ error: 'no inline preview', webViewLink: file.web_view_link }, 415);
}
if (!upstream.ok) return json({ error: `google ${upstream.status}` }, 502);

return new Response(upstream.body, {
  headers: {
    ...cors,
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'Cache-Control': 'private, max-age=300',
  },
});
```

### `/search?q=<text>`: search inside documents

```ts
const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
const escaped = q.replace(/\\/g, '\\\\').replace(/'/g, "\\'");     // Drive query-language escaping
const u = new URL('https://www.googleapis.com/drive/v3/files');
u.searchParams.set('q', `fullText contains '${escaped}' and trashed = false`);
u.searchParams.set('fields', 'files(id)');
u.searchParams.set('pageSize', '100');
u.searchParams.set('corpora', 'allDrives');
u.searchParams.set('includeItemsFromAllDrives', 'true');
u.searchParams.set('supportsAllDrives', 'true');
const ids = (await (await gfetch(SCOPES.drive, u.toString())).json()).files.map((f: { id: string }) => f.id);

// Intersect with what THIS user may see.
const { data } = await asUser.from('drive_files')
  .select('id, name, path, mime_type, modified_at').in('id', ids);
return json({ results: data ?? [] });
```

The SA sees every shared root, so the RLS intersection is what keeps search honest. Never return Drive results that are not in `drive_files`.

---

## 7. `google-calendar` Edge Function

### `/sync`: pull (cron, every 15 min)

For each enabled calendar with `direction in ('pull','both')`:

1. `GET /calendar/v3/calendars/{calendarId}/events?singleEvents=true&timeMin=<now−30d>&timeMax=<now+180d>&maxResults=2500` (paginate). `singleEvents=true` expands recurrences, so we store plain instances.
2. Skip items with `status = 'cancelled'` and items carrying `extendedProperties.private.p3md_event_id` (our own pushes).
3. Map: `summary → title`, `description → description` (strip HTML on render), `location`, `start.dateTime | start.date` → `starts_at` (all-day dates at 00:00 `+07:00`; Google's all-day `end.date` is exclusive), `htmlLink → event_google_links.html_link`.
4. `rpc('upsert_google_event', …)` per item: events row with `source = 'google'`, `created_by = null` (so nobody can edit it in the app), link row, and one `event_audience` row for the calendar's role or group.
5. `rpc('prune_google_events', …)` removes pulled events in the window that Google no longer returns.

Imported events never notify anyone (the invite trigger skips `source = 'google'`).

### `/push`: app → Google (triggered, per event)

```ts
// body: { event_id, op: 'upsert' | 'delete', links? }
const gid = event_id.replaceAll('-', '');   // UUID hex ⊂ base32hex: a valid, deterministic Google event id

function toGoogle(ev: AppEvent) {
  return {
    id: gid,
    summary: ev.title,
    description: `${ev.description ?? ''}\n\n— Managed in P3MD. Edit it in the app.`,
    location: ev.location ?? undefined,
    start: ev.all_day ? { date: ev.starts_at.slice(0, 10) } : { dateTime: ev.starts_at, timeZone: 'Asia/Jakarta' },
    end: ev.all_day ? { date: ev.ends_at.slice(0, 10) } : { dateTime: ev.ends_at, timeZone: 'Asia/Jakarta' },
    recurrence: ev.rrule ? [`RRULE:${ev.rrule}`] : undefined,     // events.rrule stores the value without "RRULE:"
    extendedProperties: { private: { p3md_event_id: ev.id } },
  };
}
```

Reconcile, don't diff by hand:

1. `op = 'delete'` → `DELETE` every link passed in the body. Done.
2. Load the event, its audience and existing links. **Desired calendars** = enabled calendars with `direction in ('push','both')` whose `role_id`/`group_id` is in the event's audience (a user-only audience pushes nowhere; those people get the per-user ICS feed instead).
3. For each desired calendar: `POST …/events` with the deterministic `id`; on `409` (already exists) → `PUT …/events/{gid}`. Upsert the link.
4. For each existing link not desired anymore: `DELETE` in Google, delete the link.

Deterministic IDs make every call idempotent: the trigger can fire twice (event insert, then audience insert) without creating duplicates.

---

## 8. Frontend

### Documents module (`/dashboard/documents`)

- **Left:** Drive roots the user can see → folder tree (rows with the folder mime type, by `parent_id`).
- **Main:** the template's data table: name, path, type icon, modified; instant name filter (`ilike` on the trigram index); a "Search inside documents" toggle that calls `google-drive/search`.
- **Viewer** (`/dashboard/documents/[id]`):

```ts
// src/features/documents/lib/load-file.ts
'use client';
import { createClient } from '@/lib/supabase/client';

export async function loadDocument(fileId: string): Promise<{ url: string; type: string } | { error: string; webViewLink?: string }> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/google-drive/file?id=${encodeURIComponent(fileId)}`,
    { headers: { Authorization: `Bearer ${data.session?.access_token}` } },
  );
  if (!res.ok) return await res.json();
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), type: blob.type };  // revoke on unmount
}
```

  PDFs render in an `<iframe src={url}>` on desktop; on phones show an "Open" button (`window.open(url)`), because mobile browsers render inline PDFs poorly. Images render inline. `415` → "No preview for this type" + "Open in Google Drive" (works only for people who also have Drive access).
- **Alternative without the proxy:** `<iframe src="https://drive.google.com/file/d/<id>/preview">` works when the viewer is signed in to Google and has Drive access to the file. It bypasses our RBAC, so use it only for folders shared with the whole organisation.

### Agenda additions

- Google-pulled events show a small "Google" badge, open read-only, and offer "Open in Google Calendar" (`html_link`).
- The event form shows which linked Google calendars the event will appear in (derived from the chosen roles/groups).

### Admin → Integrations (`integrations.manage`, `documents.manage`)

- Shows the SA email with a copy button ("share folders and calendars with this address").
- Drive roots: add by folder URL or ID, name, access (roles/groups), enable/disable, last sync, last error, "Sync now".
- Calendars: add by calendar ID, direction, role/group, last sync, last error, "Sync now".

---

## 9. Talent: CVs in Drive

If the 400 documents include candidate CVs, keep them in a dedicated Drive root visible only to `talent.read` holders. M9 then records `candidates.cv_drive_file_id` instead of a Storage path, and `parse-cv` reads the file through the same SA helper. This keeps CVs out of Supabase's 1 GB free storage. The UU PDP rules still apply (contract C-08, C-18): consent before processing, no raw text persisted, access logged in `document_views`.

---

## 10. Limits and gotchas

| Topic | Detail |
|---|---|
| Google Docs export | Exported files are capped at 10 MB by Google; very large Docs/Sheets fail with 403 → offer "Open in Drive" |
| Big binaries | `/file` refuses above 25 MB (Edge Function memory and time limits) |
| Shortcuts | `application/vnd.google-apps.shortcut` items are skipped in v1 |
| Nested roots | A file listed under two roots is stored once (last root wins); don't configure nested roots |
| Shared Drives | Every Drive call sets `supportsAllDrives=true` (+ `includeItemsFromAllDrives=true` for lists) |
| Attendees | The SA cannot add attendees without domain-wide delegation; we never set `attendees` |
| Recurrence exceptions | Pulled events are expanded instances (`singleEvents=true`); pushed recurring events carry only the RRULE, so exceptions must be edited in the app |
| Quotas | Drive and Calendar per-project quotas are far above ~50 calls per sync run; back off on 403 `rateLimitExceeded` / 429 |
| Key hygiene | SA key only in Supabase secrets (C-18); rotate yearly and on staff changes; never in Vercel env or the repo |
| Agent layer | `search_documents` returns names, paths and deep links only, never content (C-18) |
