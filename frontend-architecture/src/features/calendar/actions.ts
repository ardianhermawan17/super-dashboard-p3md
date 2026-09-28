'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/require';
import { z } from 'zod';
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

      // PSI-102: find linked kanban boards so the event detail dialog can show
      // "Create event board" vs "Open board".
      const boardIdByEvent = new Map<string, string>();
      if (eventIds.length > 0) {
        const { data: linkedBoards } = await supabase
          .from('boards')
          .select('id, event_id')
          .in('event_id', eventIds);
        for (const b of linkedBoards ?? []) {
          if (b.event_id) boardIdByEvent.set(b.event_id, b.id);
        }
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
        audience: audienceMap.get(e.id) ?? [],
        board_id: boardIdByEvent.get(e.id) ?? null
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

// ---------------------------------------------------------------------------
// PSI-042: Event form (create/edit/delete) with a user/role/group audience picker
// ---------------------------------------------------------------------------

const AudienceEntrySchema = z.object({
  user_id: z.string().uuid().optional(),
  role_id: z.string().uuid().optional(),
  group_id: z.string().uuid().optional()
});

const EventFormSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().nullable().optional(),
    location: z.string().trim().nullable().optional(),
    starts_at: z.string().min(1), // ISO, UTC
    ends_at: z.string().min(1),
    all_day: z.boolean(),
    rrule: z.string().trim().nullable().optional(),
    audience: z.array(AudienceEntrySchema)
  })
  .refine((v) => new Date(v.ends_at) >= new Date(v.starts_at), {
    message: 'End time must be on or after the start time',
    path: ['ends_at']
  });

export type EventFormInput = z.infer<typeof EventFormSchema>;

export async function getAudienceOptionsAction(): Promise<{
  users: { id: string; full_name: string | null }[];
  roles: { id: string; name: string }[];
  groups: { id: string; name: string }[];
}> {
  const session = await getSession();
  if (!session) return { users: [], roles: [], groups: [] };
  const supabase = await createClient();

  const [{ data: users }, { data: roles }, { data: groups }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('status', 'active').order('full_name'),
    supabase.from('roles').select('id, name').order('name'),
    supabase.from('groups').select('id, name').order('name')
  ]);

  return { users: users ?? [], roles: roles ?? [], groups: groups ?? [] };
}

/** One insert per audience row, all in a single statement so the M4 `event_audience_invites`
 * statement-level trigger fires exactly once and notifies the whole audience together. */
function toAudienceRows(eventId: string, audience: EventFormInput['audience']) {
  return audience.map((a) => ({
    event_id: eventId,
    user_id: a.user_id ?? null,
    role_id: a.role_id ?? null,
    group_id: a.group_id ?? null
  }));
}

export async function createEventAction(
  input: EventFormInput
): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  let session;
  try {
    session = await requirePermission('calendar.write');
  } catch {
    return { ok: false, error: 'Forbidden: missing calendar.write' };
  }

  const parsed = EventFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid event' };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { data: newEvent, error: insertError } = await supabase
    .from('events')
    .insert({
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      all_day: data.all_day,
      rrule: data.rrule || null,
      source: 'app',
      created_by: session.userId
    })
    .select('id')
    .single();

  if (insertError || !newEvent) {
    return { ok: false, error: insertError?.message ?? 'Failed to create event' };
  }

  if (data.audience.length > 0) {
    const { error: audienceError } = await supabase
      .from('event_audience')
      .insert(toAudienceRows(newEvent.id, data.audience));
    if (audienceError) {
      return { ok: false, error: audienceError.message };
    }
  }

  return { ok: true, eventId: newEvent.id };
}

export async function updateEventAction(
  eventId: string,
  input: EventFormInput
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };

  const parsed = EventFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid event' };
  }
  const data = parsed.data;
  const supabase = await createClient();

  // RLS (M4) already restricts update to the creator; the explicit filter here
  // keeps the "not yours / not an app event" case a clean error instead of a
  // silent 0-row no-op.
  const { data: updated, error: updateError } = await supabase
    .from('events')
    .update({
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      all_day: data.all_day,
      rrule: data.rrule || null
    })
    .eq('id', eventId)
    .eq('created_by', session.userId)
    .eq('source', 'app')
    .select('id')
    .maybeSingle();

  if (updateError) {
    return { ok: false, error: updateError.message };
  }
  if (!updated) {
    return { ok: false, error: 'Event not found or not editable' };
  }

  // Audience is replaced wholesale on edit (M4 doc: re-notifying the whole
  // audience on an audience change is acceptable in v1).
  const { error: deleteError } = await supabase
    .from('event_audience')
    .delete()
    .eq('event_id', eventId);
  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  if (data.audience.length > 0) {
    const { error: audienceError } = await supabase
      .from('event_audience')
      .insert(toAudienceRows(eventId, data.audience));
    if (audienceError) {
      return { ok: false, error: audienceError.message };
    }
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

// ---------------------------------------------------------------------------
// PSI-102: Create an event board from the calendar
// ---------------------------------------------------------------------------

const DEFAULT_BOARD_COLUMNS = [
  { title: 'Backlog', position: 'a0', is_done: false },
  { title: 'In Progress', position: 'a1', is_done: false },
  { title: 'Done', position: 'a2', is_done: true }
] as const;

/**
 * Create the kanban board for an event (PSI-102).
 *
 * Rules (from docs/frontend-architecture/features/finance.md §1):
 * - The board is named after the event and `boards.event_id` is set.
 * - The event's GROUP audience is copied into `board_groups`.
 *   Users and roles in the audience are NOT copied (boards share with
 *   users and groups only; the creator adds people by hand).
 * - Idempotent: a second call returns the existing board. The unique index
 *   `boards(event_id) where event_id is not null` also enforces this at the DB.
 */
export async function createEventBoardAction(
  eventId: string
): Promise<{ ok: boolean; boardId?: string; error?: string }> {
  let session;
  try {
    session = await requirePermission('kanban.write');
  } catch {
    return { ok: false, error: 'Forbidden: missing kanban.write' };
  }
  const supabase = await createClient();

  // Idempotency: return the existing board when one is already linked.
  const { data: existingBoard } = await supabase
    .from('boards')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existingBoard) {
    return { ok: true, boardId: existingBoard.id };
  }

  // Fetch the event to name the board after it.
  const { data: eventRow } = await supabase
    .from('events')
    .select('id, title')
    .eq('id', eventId)
    .single();

  if (!eventRow) {
    return { ok: false, error: 'Event not found' };
  }

  // Create the board.
  const { data: newBoard, error: boardError } = await supabase
    .from('boards')
    .insert({
      name: eventRow.title,
      event_id: eventId,
      created_by: session.userId
    })
    .select('id, name, event_id')
    .single();

  if (boardError || !newBoard) {
    return { ok: false, error: boardError?.message ?? 'Failed to create board' };
  }

  // Default columns (same shape as getBoardAction's auto-created board).
  await supabase.from('board_columns').insert(
    DEFAULT_BOARD_COLUMNS.map((c) => ({
      board_id: newBoard.id,
      title: c.title,
      position: c.position,
      is_done: c.is_done
    }))
  );

  // Copy the event's GROUP audience into board_groups (users/roles excluded).
  const { data: audienceRows } = await supabase
    .from('event_audience')
    .select('group_id')
    .eq('event_id', eventId);

  const groupIds = Array.from(
    new Set((audienceRows ?? []).map((a) => a.group_id).filter((g): g is string => Boolean(g)))
  );
  if (groupIds.length > 0) {
    await supabase.from('board_groups').insert(
      groupIds.map((groupId) => ({ board_id: newBoard.id, group_id: groupId }))
    );
  }

  return { ok: true, boardId: newBoard.id };
}
