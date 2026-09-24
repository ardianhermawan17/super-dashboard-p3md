# Google integration (Drive documents, Calendar sync)

> **Scope:** the service account, the `google-drive` and `google-calendar` Edge Functions, setup, limits.
> Schema: [m6-google.md](../database-architecture/m6-google.md) · UI: [documents.md](../frontend-architecture/features/documents.md), [calendar.md](../frontend-architecture/features/calendar.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Decisions

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

## Flow

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

## Google Cloud setup (human, once)

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

## Service-account token helper

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

## `google-drive` Edge Function

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

After a run, emit one `document.added` notification per root that gained files ([push-notifications.md](push-notifications.md#what-creates-notifications)).

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

## `google-calendar` Edge Function

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

## Talent: CVs in Drive

If the 400 documents include candidate CVs, keep them in a dedicated Drive root visible only to `talent.read` holders. M9 then records `candidates.cv_drive_file_id` instead of a Storage path, and `parse-cv` reads the file through the same SA helper. This keeps CVs out of Supabase's 1 GB free storage. The UU PDP rules still apply (contract C-08, C-18): consent before processing, no raw text persisted, access logged in `document_views`.

## Limits and gotchas

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
