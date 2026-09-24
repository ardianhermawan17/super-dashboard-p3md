# PWA and notifications

> **Scope:** the installable app (manifest, service worker), Web Push, the in-app notification center, and migration M2.
> Gateway: [README_AI_AGENT.md](../README_AI_AGENT.md) · Related: [frontend-architecture.md](frontend-architecture.md), [backend-architecture.md](backend-architecture.md)

## Contents

1. [Decision: a notification-first PWA](#1-decision-a-notification-first-pwa)
2. [Flow](#2-flow)
3. [Migration M2](#3-migration-m2)
4. [What creates notifications](#4-what-creates-notifications)
5. [PWA shell](#5-pwa-shell)
6. [Enabling push on a device](#6-enabling-push-on-a-device)
7. [Dispatch route](#7-dispatch-route)
8. [Notification center and bell](#8-notification-center-and-bell)
9. [Environment variables](#9-environment-variables)
10. [Device support and QA](#10-device-support-and-qa)

---

## 1. Decision: a notification-first PWA

**Yes, it is a PWA**, scoped to what matters on a phone:

| In scope | Out of scope (v1) |
|---|---|
| Installable (Android, iOS, desktop) with its own icon and window | Offline data, background sync |
| Web Push for mail, invites, assignments, digests | Caching API responses in the service worker |
| `start_url` = `/dashboard/notifications`: a mobile-first notification dashboard | A separate mobile app |
| Realtime bell + unread count everywhere in the dashboard | SMS / WhatsApp channels |

No `next-pwa` plugin: Next.js 16 supports a manifest route and a hand-written service worker natively, and our service worker only handles push, so ~40 lines beat a plugin.

**Delivery policy:** every notification is stored and shown in-app; push is sent when the user has a subscription and hasn't muted that type. Email stays for role mail only. Push is free, which keeps email volume (and Resend quota) low.

## 2. Flow

```
trigger / Edge Function ──▶ public.notify(user_ids[], type, title, body, link)
                                   │ inserts rows into notifications
                                   ▼
             statement trigger (one call per insert batch, via pg_net)
                                   ▼
          POST {site}/api/push/dispatch   (Node runtime, web-push, VAPID)
                                   ▼
          push service (FCM / Apple / Mozilla) ──▶ service worker ──▶ OS notification
                                                                        │ tap
                                                                        ▼
                                                         deep link /dashboard/<feature>/<id>
In the open app: Supabase Realtime on notifications ──▶ bell count + list update live
```

---

## 3. Migration M2

M2 also installs `pg_net` / `pg_cron` and the `internal_post()` helper every later migration uses to call Edge Functions or Next.js routes.

```sql
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- One helper for all internal HTTP calls. Secrets come from Vault (set once per environment, §9).
create or replace function public.internal_post(p_target text, p_path text, p_body jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_base text;
begin
  v_base := case p_target
    when 'functions' then (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/'
    when 'site' then (select decrypted_secret from vault.decrypted_secrets where name = 'site_url') || '/'
  end;
  if v_base is null then
    raise exception 'internal_post: unknown target % or missing Vault secret', p_target;
  end if;
  return net.http_post(
    url := v_base || p_path,
    body := p_body,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'internal_fn_secret')),
    timeout_milliseconds := 5000);
end $$;
revoke execute on function public.internal_post(text, text, jsonb) from public, anon, authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('mail.received', 'event.invited', 'event.updated',
                                     'task.assigned', 'digest.ready', 'document.added', 'system')),
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 240),
  link text,                                   -- /dashboard/<feature>/<id>
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz
);
create index on public.notifications (user_id, created_at desc);
create index on public.notifications (user_id) where read_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create table public.notification_prefs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null,
  push boolean not null default true,
  primary key (user_id, type)
);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;

create policy "own notifications readable" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own notifications markable" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;          -- mark read, nothing else
-- No insert policy: rows are created only by notify() (security definer).

create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own prefs" on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Create notifications (called by triggers and Edge Functions).
create or replace function public.notify(p_users uuid[], p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select distinct u, p_type, left(p_title, 120), left(p_body, 240), p_link
    from unnest(p_users) as u
   where u is not null;
$$;
revoke execute on function public.notify(uuid[], text, text, text, text) from public, anon, authenticated;
grant execute on function public.notify(uuid[], text, text, text, text) to service_role;

-- A device endpoint belongs to whoever registered it last (shared devices, re-logins).
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void language sql security definer set search_path = '' as $$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
$$;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- Everything the dispatcher needs in one call (arrays go in the POST body, not a long URL).
create or replace function public.push_targets(p_ids uuid[])
returns table (notification_id uuid, title text, body text, link text, subscription_id uuid,
               endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select n.id, n.title, n.body, n.link, s.id, s.endpoint, s.p256dh, s.auth
    from public.notifications n
    join public.push_subscriptions s on s.user_id = n.user_id
   where n.id = any(p_ids)
     and not exists (select 1 from public.notification_prefs np
                      where np.user_id = n.user_id and np.type = n.type and np.push = false);
$$;
revoke execute on function public.push_targets(uuid[]) from public, anon, authenticated;
grant execute on function public.push_targets(uuid[]) to service_role;

create or replace function public.mark_pushed(p_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.notifications set pushed_at = now() where id = any(p_ids);
$$;
revoke execute on function public.mark_pushed(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_pushed(uuid[]) to service_role;

-- One dispatch call per INSERT statement (400 recipients = 1 HTTP call, not 400).
create or replace function public.dispatch_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.internal_post('site', 'api/push/dispatch',
    jsonb_build_object('ids', (select jsonb_agg(id) from new_rows)));
  return null;
end $$;
create trigger notifications_dispatch after insert on public.notifications
  referencing new table as new_rows for each statement execute function public.dispatch_push();

alter publication supabase_realtime add table public.notifications;

-- Keep the table small: read notifications older than 90 days go away.
select cron.schedule('notifications-retention', '45 20 * * *',
  $$ delete from public.notifications where read_at is not null and created_at < now() - interval '90 days' $$);
```

---

## 4. What creates notifications

| Type | Created by | Recipients | Link |
|---|---|---|---|
| `mail.received` | `send-role-mail` after resolving recipients | Every resolved recipient | `/dashboard/mail/<id>` |
| `event.invited` | Statement trigger on `event_audience` insert (app events only, never Google-imported ones) | Resolved audience minus the creator | `/dashboard/calendar?event=<id>` |
| `event.updated` | Trigger on `events` time/location change | Resolved audience | same |
| `task.assigned` | Trigger on `tasks.assignee_id` change (not self-assignment) | The assignee | `/dashboard/kanban/<board>?task=<id>` |
| `digest.ready` | `daily-digest` | `users_with_permission('digest.receive')` | `/dashboard/overview?digest=<id>` |
| `document.added` | `google-drive/sync` (batched: one per root per run) | Users who can see that root | `/dashboard/documents?root=<id>` |

**Payload rule:** titles and bodies are short and contain no personal data beyond what the recipient already sees in-app (e.g. a mail subject). Never a mail body, never CV content.

---

## 5. PWA shell

```ts
// src/app/manifest.ts  → served at /manifest.webmanifest
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'P3MD Social',
    short_name: 'P3MD',
    description: 'Notifications, role mail, agenda and boards for P3MD',
    start_url: '/dashboard/notifications',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

```js
// public/sw.js : push only, no caching
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'P3MD', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url: data.url ?? '/dashboard/notifications' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/dashboard/notifications', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((w) => w.url.startsWith(self.location.origin));
    if (open) {
      await open.focus();
      return open.navigate(url);
    }
    return clients.openWindow(url);
  })());
});
```

```ts
// next.config.ts (merge into the template's config)
async headers() {
  return [
    {
      source: '/sw.js',
      headers: [
        { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
      ],
    },
  ];
},
```

**Proxy:** `sw.js`, `manifest.webmanifest` and `/icons/` must never redirect to sign-in, and `/api/push/dispatch` authenticates with its own secret. Both are handled in `src/lib/supabase/proxy.ts` and the matcher (frontend doc §4).

---

## 6. Enabling push on a device

Ask for permission **only after a tap** on an "Enable notifications" button (settings page or a dismissible banner on the notification center), never on page load.

```ts
// src/features/notifications/lib/push.ts
'use client';
import { createClient } from '@/lib/supabase/client';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { ok: false, reason: 'unsupported' };
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: permission };

  const sub = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  });
  const json = sub.toJSON();
  const { error } = await createClient().rpc('register_push_subscription', {
    p_endpoint: json.endpoint!,
    p_p256dh: json.keys!.p256dh,
    p_auth: json.keys!.auth,
    p_user_agent: navigator.userAgent,
  });
  return error ? { ok: false, reason: error.message } : { ok: true };
}

// iOS only delivers push to an installed (home-screen) app.
export const needsInstallFirst = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.matchMedia('(display-mode: standalone)').matches;
```

When `needsInstallFirst()` is true, show "Tap Share → Add to Home Screen, then open P3MD from your home screen" instead of the enable button.

---

## 7. Dispatch route

Runs on the Node runtime because `web-push` needs Node crypto. It is one of the two Next.js routes allowed to use the secret key (the other is the ICS feed).

```ts
// src/app/api/push/dispatch/route.ts
import 'server-only';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,                 // mailto:admin@your-domain.id
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: size }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
  }));
}

export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.INTERNAL_FN_SECRET}`) {
    return new Response('forbidden', { status: 403 });
  }
  const { ids } = (await req.json()) as { ids: string[] };
  const { data: targets, error } = await admin.rpc('push_targets', { p_ids: ids });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const gone: string[] = [];
  await pool(targets ?? [], 20, async (t) => {
    try {
      await webpush.sendNotification(
        { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        JSON.stringify({ title: t.title, body: t.body, url: t.link }),
        { TTL: 60 * 60 * 24 },
      );
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) gone.push(t.subscription_id);   // device unsubscribed
    }
  });

  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone);
  await admin.rpc('mark_pushed', { p_ids: ids });
  return Response.json({ ok: true, sent: (targets?.length ?? 0) - gone.length });
}
```

Generate VAPID keys once: `npx web-push generate-vapid-keys`.

---

## 8. Notification center and bell

- **`/dashboard/notifications`** (PWA start page): unread first, grouped Today / Earlier, filter by type, swipe or button to mark read, "Mark all read". Big tap targets; quick links to Agenda (today), Mail and Board at the top.
- **Bell** in the dashboard header (reuse the template's notifications UI): unread count from `select count(*) … where read_at is null`, updated live:

```ts
// src/features/notifications/hooks/use-notification-feed.ts
'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { notificationKeys } from '../api/keys';

export function useNotificationFeed(userId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: notificationKeys.all }))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
```

- **`/dashboard/settings/notifications`**: enable/disable push on this device, per-type push toggles (`notification_prefs`), list of this user's devices with "remove".

---

## 9. Environment variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | browser + server | Public by design |
| `VAPID_PRIVATE_KEY` | server only | Never `NEXT_PUBLIC_` |
| `VAPID_SUBJECT` | server | `mailto:` address of the operator |
| `INTERNAL_FN_SECRET` | server + Edge Functions + Vault | Same value in all three; rotate together |
| `SUPABASE_SECRET_KEY` | server only | Dispatch route (and ICS feed) |

Vault secrets (once per environment; local values go in `seed.sql`):

```sql
select vault.create_secret('https://<ref>.supabase.co', 'project_url');
select vault.create_secret('https://<your-site>', 'site_url');      -- local: http://host.docker.internal:3000
select vault.create_secret('<long random string>', 'internal_fn_secret');
```

---

## 10. Device support and QA

| Platform | Install | Push | Notes |
|---|---|---|---|
| Android · Chrome | Install prompt / menu | ✓ | Most P3MD users; test first |
| iOS / iPadOS 16.4+ · Safari | Share → Add to Home Screen | ✓ only when installed | Permission request must follow a tap |
| Desktop · Chrome, Edge | Install icon in address bar | ✓ | |
| Desktop · Firefox | No install | ✓ | Works as a normal tab |
| Desktop · Safari (macOS) | Add to Dock | ✓ | |

QA checklist (PSI-025): install on Android and iPhone; enable push; send a role mail to a role you hold; tap the notification → lands on the message; mute `mail.received` → no push but the item still appears in the center; revoke permission in OS settings → the next dispatch deletes the dead subscription (410).
