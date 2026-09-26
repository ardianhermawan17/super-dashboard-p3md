'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import type { CalendarEvent, EventAudience } from './types';

export async function getCalendarEventsAction(options?: {
  from?: string;
  to?: string;
}): Promise<{ events: CalendarEvent[] }> {
  const session = await getSession();
  if (!session) return { events: [] };
  const supabase = await createClient();

  let query = supabase
    .from('events')
    .select('*')
    .order('starts_at', { ascending: true });

  if (options?.from) {
    query = query.gte('ends_at', options.from);
  }
  if (options?.to) {
    query = query.lte('starts_at', options.to);
  }

  const { data: eventsData, error } = await query;
  if (error || !eventsData) {
    return { events: [] };
  }

  const eventIds = eventsData.map((e) => e.id);
  let audienceRows: {
    event_id: string;
    user_id: string | null;
    role_id: string | null;
    group_id: string | null;
  }[] = [];

  if (eventIds.length > 0) {
    const { data: audData } = await supabase
      .from('event_audience')
      .select('event_id, user_id, role_id, group_id')
      .in('event_id', eventIds);
    audienceRows = audData ?? [];
  }

  const audienceMap = new Map<string, EventAudience[]>();
  for (const aud of audienceRows) {
    const list = audienceMap.get(aud.event_id) ?? [];
    if (aud.user_id) {
      list.push({ kind: 'user', user_id: aud.user_id });
    } else if (aud.role_id) {
      list.push({ kind: 'role', role_id: aud.role_id });
    } else if (aud.group_id) {
      list.push({ kind: 'group', group_id: aud.group_id });
    }
    audienceMap.set(aud.event_id, list);
  }

  const events: CalendarEvent[] = eventsData.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    all_day: e.all_day,
    rrule: e.rrule,
    source: e.source as CalendarEvent['source'],
    created_by: e.created_by,
    created_at: e.created_at,
    audience: audienceMap.get(e.id) ?? []
  }));

  return { events };
}

export async function deleteEventAction(eventId: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('created_by', session.userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

function generateSecureToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getCalendarFeedTokenAction(): Promise<{ token: string | null; error?: string }> {
  const session = await getSession();
  if (!session) return { token: null, error: 'Unauthorized' };
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('calendar_feed_tokens')
    .select('token')
    .eq('user_id', session.userId)
    .maybeSingle();

  if (existing?.token) {
    return { token: existing.token };
  }

  const newToken = generateSecureToken();
  const { error: insertError } = await supabase
    .from('calendar_feed_tokens')
    .insert({
      user_id: session.userId,
      token: newToken
    });

  if (insertError) {
    return { token: null, error: insertError.message };
  }

  return { token: newToken };
}

export async function rotateCalendarFeedTokenAction(): Promise<{ token: string | null; error?: string }> {
  const session = await getSession();
  if (!session) return { token: null, error: 'Unauthorized' };
  const supabase = await createClient();

  await supabase
    .from('calendar_feed_tokens')
    .delete()
    .eq('user_id', session.userId);

  const newToken = generateSecureToken();
  const { error: insertError } = await supabase
    .from('calendar_feed_tokens')
    .insert({
      user_id: session.userId,
      token: newToken
    });

  if (insertError) {
    return { token: null, error: insertError.message };
  }

  return { token: newToken };
}
