// supabase/functions/google-calendar/index.ts
// Google Calendar sync endpoint: /sync (pull cron, PSI-065) and /push (event triggers, PSI-066).
// Spec: docs/backend-architecture/google-integration.md § "google-calendar Edge Function"

import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/http.ts';
import { assertInternal } from '../_shared/internal.ts';
import { gfetch, GOOGLE_SCOPES } from '../_shared/google.ts';
import { GoogleEventItem, mapGoogleEvent } from './mapper.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type CalendarRow = {
  id: string;
  calendar_id: string;
  name: string;
  direction: 'pull' | 'push' | 'both';
  role_id: string | null;
  group_id: string | null;
  enabled: boolean;
};

export async function pullCalendar(
  supabase: ReturnType<typeof createClient>,
  cal: CalendarRow
): Promise<{ pulled: number; pruned: number }> {
  const now = new Date();
  const runStart = now.toISOString();

  // Window: 30 days past to 180 days future
  const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();

  let pageToken: string | undefined = undefined;
  let pulledCount = 0;

  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      timeMin,
      timeMax,
      maxResults: '2500',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.calendar_id)}/events?${params}`;
    const res = await gfetch(GOOGLE_SCOPES.calendarReadonly, url);

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Google Calendar API ${res.status} on ${cal.calendar_id}: ${err}`);
    }

    const data = await res.json();
    const items: GoogleEventItem[] = data.items ?? [];

    for (const item of items) {
      const mapped = mapGoogleEvent(cal.calendar_id, item);
      if (!mapped) continue;

      const { error: rpcErr } = await supabase.rpc('upsert_google_event', {
        p_calendar_id: mapped.calendar_id,
        p_google_event_id: mapped.google_event_id,
        p_title: mapped.title,
        p_description: mapped.description,
        p_location: mapped.location,
        p_starts_at: mapped.starts_at,
        p_ends_at: mapped.ends_at,
        p_all_day: mapped.all_day,
        p_rrule: mapped.rrule,
        p_html_link: mapped.html_link,
      });

      if (rpcErr) {
        throw new Error(`upsert_google_event rpc error: ${rpcErr.message}`);
      }
      pulledCount++;
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  // Prune events that Google no longer returned in the sync window
  const { data: prunedCount, error: pruneErr } = await supabase.rpc('prune_google_events', {
    p_calendar_id: cal.calendar_id,
    p_before: runStart,
    p_from: timeMin,
    p_to: timeMax,
  });

  if (pruneErr) {
    throw new Error(`prune_google_events rpc error: ${pruneErr.message}`);
  }

  return { pulled: pulledCount, pruned: (prunedCount as number) ?? 0 };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    assertInternal(req);
  } catch (err) {
    if (err instanceof Response) return err;
    return json({ error: 'unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/google-calendar\/?/, '');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --------------------------------------------------------------------------
  // ROUTE 1: /sync (pull cron, PSI-065)
  // --------------------------------------------------------------------------
  if (path === 'sync' || path === '' || path === '/') {
    const { data: calendars, error } = await supabase
      .from('google_calendars')
      .select('*')
      .in('direction', ['pull', 'both'])
      .eq('enabled', true);

    if (error) {
      return json({ error: `failed to query google_calendars: ${error.message}` }, 500);
    }

    const results: Array<{ calendar_id: string; pulled: number; pruned: number; error?: string }> = [];

    for (const cal of (calendars ?? []) as CalendarRow[]) {
      try {
        const stats = await pullCalendar(supabase, cal);
        await supabase
          .from('google_calendars')
          .update({
            last_synced_at: new Date().toISOString(),
            last_error: null,
          })
          .eq('id', cal.id);

        results.push({ calendar_id: cal.calendar_id, ...stats });
      } catch (calErr) {
        const msg = calErr instanceof Error ? calErr.message : String(calErr);
        await supabase
          .from('google_calendars')
          .update({
            last_synced_at: new Date().toISOString(),
            last_error: msg.slice(0, 500),
          })
          .eq('id', cal.id);

        results.push({ calendar_id: cal.calendar_id, pulled: 0, pruned: 0, error: msg });
      }
    }

    return json({
      ok: true,
      processed: results.length,
      results,
    });
  }

  // --------------------------------------------------------------------------
  // ROUTE 2: /push (app -> Google trigger, PSI-066 stub)
  // --------------------------------------------------------------------------
  if (path === 'push') {
    return json({ ok: true, message: 'push route registered (PSI-066 target)' });
  }

  return json({ error: `unknown route: ${path}` }, 404);
});
