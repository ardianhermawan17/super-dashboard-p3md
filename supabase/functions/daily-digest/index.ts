import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/http.ts';
import { assertInternal } from '../_shared/internal.ts';
import { generateDailyDigestSummary, type DigestContextData } from './digest.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    // 1. Authenticate internal caller (pg_cron or internal_post)
    assertInternal(req);

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const periodEnd = now.toISOString();
    const periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 2. Fetch last 24h activity log
    const { data: rawActivities, error: actErr } = await admin
      .from('activity_log')
      .select('occurred_at, actor_name, action, entity_type, entity_name, summary, board_name')
      .gte('occurred_at', periodStart)
      .lte('occurred_at', periodEnd)
      .order('occurred_at', { ascending: true })
      .limit(50);

    if (actErr) {
      console.error('Error fetching activity log:', actErr);
    }

    // 3. Fetch today's agenda events
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const { data: rawEvents, error: evtErr } = await admin
      .from('events')
      .select('title, starts_at, ends_at, all_day, location')
      .gte('starts_at', todayStart)
      .lte('starts_at', todayEnd)
      .order('starts_at', { ascending: true })
      .limit(30);

    if (evtErr) {
      console.error('Error fetching events:', evtErr);
    }

    // 4. Fetch open/pending tasks
    const { data: rawTasks, error: taskErr } = await admin
      .from('tasks')
      .select('title, due_date, board_columns(title, is_done)')
      .limit(30);

    if (taskErr) {
      console.error('Error fetching tasks:', taskErr);
    }

    const tasks = (rawTasks || [])
      .filter((t: any) => !t.board_columns?.is_done)
      .map((t: any) => ({
        title: t.title,
        due_date: t.due_date,
        column_title: t.board_columns?.title,
      }));

    const contextData: DigestContextData = {
      activities: (rawActivities || []).map((a) => ({
        occurred_at: a.occurred_at,
        actor_name: a.actor_name,
        action: a.action,
        entity_type: a.entity_type,
        entity_name: a.entity_name,
        summary: a.summary,
        board_name: a.board_name,
      })),
      events: (rawEvents || []).map((e) => ({
        title: e.title,
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        all_day: e.all_day,
        location: e.location,
      })),
      tasks,
    };

    // 5. Generate summary with DIGEST_MODEL (Claude Haiku or Hermes)
    const modelSpec = Deno.env.get('DIGEST_MODEL') || 'anthropic:claude-haiku-4-5-20251001';
    const summaryMd = await generateDailyDigestSummary(contextData, modelSpec);

    // 6. Insert digest into public.digests
    const { data: digestRow, error: insertErr } = await admin
      .from('digests')
      .insert({
        period_start: periodStart,
        period_end: periodEnd,
        content_md: summaryMd,
        model: modelSpec,
      })
      .select('id')
      .single();

    if (insertErr || !digestRow) {
      throw new Error(`Failed to insert digest: ${insertErr?.message}`);
    }

    // 7. Notify users who hold 'digest.receive' permission
    const { data: userIds, error: userErr } = await admin.rpc('users_with_permission', {
      p_key: 'digest.receive',
    });

    let notifiedCount = 0;
    if (!userErr && userIds && userIds.length > 0) {
      const formattedIds = userIds.map((u: any) => (typeof u === 'string' ? u : u.id || u.user_id));
      const dateLabel = now.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      await admin.rpc('notify', {
        p_users: formattedIds,
        p_type: 'digest.ready',
        p_title: 'Daily Digest Ready',
        p_body: `Morning briefing for ${dateLabel} is ready.`,
        p_link: `/dashboard/overview?digest=${digestRow.id}`,
      });
      notifiedCount = formattedIds.length;
    }

    return json({
      ok: true,
      digest_id: digestRow.id,
      model: modelSpec,
      notified_count: notifiedCount,
    });
  } catch (err: any) {
    if (err instanceof Response) return err;
    console.error('daily-digest error:', err);
    return json({ error: err?.message || 'internal error' }, 500);
  }
});
