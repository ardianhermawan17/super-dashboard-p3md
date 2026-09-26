import 'server-only';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'dummy-secret-key-for-build';

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function initVapid() {
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (vapidPublicKey && vapidPrivateKey) {
    try {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } catch {
      // ignore initialization error if invalid mock key in build
    }
  }
}

async function pool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length || 1) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) {
        await worker(item);
      }
    }
  });
  await Promise.all(workers);
}

type PushTarget = {
  notification_id: string;
  title: string;
  body: string | null;
  link: string | null;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function POST(req: Request) {
  const expectedSecret = process.env.INTERNAL_FN_SECRET || 'local-dev-internal-secret';
  const authHeader = req.headers.get('authorization');

  if (authHeader !== `Bearer ${expectedSecret}`) {
    return new Response('forbidden', { status: 403 });
  }

  let body: { ids?: string[] };
  try {
    body = (await req.json()) as { ids?: string[] };
  } catch {
    return Response.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ ok: true, sent: 0, message: 'No notification IDs provided' });
  }

  const admin = getAdminClient();
  const { data: targets, error } = await admin.rpc('push_targets', { p_ids: ids });
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const targetList = (targets ?? []) as unknown as PushTarget[];
  const gone: string[] = [];

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (vapidPublicKey && vapidPrivateKey) {
    initVapid();
    await pool(targetList, 20, async (t) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: t.endpoint,
            keys: { p256dh: t.p256dh, auth: t.auth }
          },
          JSON.stringify({
            title: t.title,
            body: t.body ?? '',
            url: t.link ?? '/dashboard/notifications'
          }),
          { TTL: 60 * 60 * 24 }
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          gone.push(t.subscription_id);
        }
      }
    });
  }

  if (gone.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', gone);
  }

  await admin.rpc('mark_pushed', { p_ids: ids });

  return Response.json({
    ok: true,
    sent: targetList.length - gone.length,
    targetsCount: targetList.length,
    prunedSubscriptions: gone.length
  });
}
