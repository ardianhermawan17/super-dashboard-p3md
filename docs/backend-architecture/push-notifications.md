# Push notifications (delivery pipeline)

> **Scope:** what creates notifications and how Web Push is delivered. The PWA shell and UI are in [notifications-pwa.md](../frontend-architecture/features/notifications-pwa.md).
> Schema: [m2-notifications.md](../database-architecture/m2-notifications.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Flow

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

## What creates notifications

| Type | Created by | Recipients | Link |
|---|---|---|---|
| `mail.received` | `send-role-mail` after resolving recipients | Every resolved recipient | `/dashboard/mail/<id>` |
| `event.invited` | Statement trigger on `event_audience` insert (app events only, never Google-imported ones) | Resolved audience minus the creator | `/dashboard/calendar?event=<id>` |
| `event.updated` | Trigger on `events` time/location change | Resolved audience | same |
| `task.assigned` | Trigger on `tasks.assignee_id` change (not self-assignment) | The assignee | `/dashboard/kanban/<board>?task=<id>` |
| `digest.ready` | `daily-digest` | `users_with_permission('digest.receive')` | `/dashboard/overview?digest=<id>` |
| `document.added` | `google-drive/sync` (batched: one per root per run) | Users who can see that root | `/dashboard/documents?root=<id>` |

**Payload rule:** titles and bodies are short and contain no personal data beyond what the recipient already sees in-app (e.g. a mail subject). Never a mail body, never CV content.

## Dispatch route

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

## Environment variables

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
