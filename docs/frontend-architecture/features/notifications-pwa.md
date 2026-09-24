# Notifications and PWA

> **Scope:** the installable app shell, push opt-in, the notification center and bell, device QA. Delivery pipeline: [push-notifications.md](../../backend-architecture/push-notifications.md) · schema: [m2-notifications.md](../../database-architecture/m2-notifications.md).
> Index: [frontend-architecture/](../README.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)

## Decision: a notification-first PWA

**Yes, it is a PWA**, scoped to what matters on a phone:

| In scope | Out of scope (v1) |
|---|---|
| Installable (Android, iOS, desktop) with its own icon and window | Offline data, background sync |
| Web Push for mail, invites, assignments, digests | Caching API responses in the service worker |
| `start_url` = `/dashboard/notifications`: a mobile-first notification dashboard | A separate mobile app |
| Realtime bell + unread count everywhere in the dashboard | SMS / WhatsApp channels |

No `next-pwa` plugin: Next.js 16 supports a manifest route and a hand-written service worker natively, and our service worker only handles push, so ~40 lines beat a plugin.

**Delivery policy:** every notification is stored and shown in-app; push is sent when the user has a subscription and hasn't muted that type. Email stays for role mail only. Push is free, which keeps email volume (and Resend quota) low.

## PWA shell

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

**Proxy:** `sw.js`, `manifest.webmanifest` and `/icons/` must never redirect to sign-in, and `/api/push/dispatch` authenticates with its own secret. Both are handled in `src/lib/supabase/proxy.ts` and the matcher ([supabase-clients-and-session.md](../supabase-clients-and-session.md)).

## Enabling push on a device

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

## Notification center and bell

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

## Device support and QA

| Platform | Install | Push | Notes |
|---|---|---|---|
| Android · Chrome | Install prompt / menu | ✓ | Most P3MD users; test first |
| iOS / iPadOS 16.4+ · Safari | Share → Add to Home Screen | ✓ only when installed | Permission request must follow a tap |
| Desktop · Chrome, Edge | Install icon in address bar | ✓ | |
| Desktop · Firefox | No install | ✓ | Works as a normal tab |
| Desktop · Safari (macOS) | Add to Dock | ✓ | |

QA checklist (PSI-025): install on Android and iPhone; enable push; send a role mail to a role you hold; tap the notification → lands on the message; mute `mail.received` → no push but the item still appears in the center; revoke permission in OS settings → the next dispatch deletes the dead subscription (410).
