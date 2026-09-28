// frontend-architecture/src/features/calendar/event-form.test.ts
// Unit tests for PSI-042: "Event form with audience picker, WIB display"
// Spec: docs/database-architecture/m4-calendar.md & PSI-042 card accept criteria

import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { EventFormInput } from './actions';

mock.module('server-only', () => ({}));

type InsertedEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  rrule: string | null;
  source: string;
  created_by: string;
};

type AudienceRow = {
  event_id: string;
  user_id: string | null;
  role_id: string | null;
  group_id: string | null;
};

let insertedEvents: InsertedEvent[] = [];
let audienceRows: AudienceRow[] = [];
let nextEventId = 1;

let mockSessionUser: { userId: string; email: string; permissions: string[] } | null = {
  userId: 'user-creator-123',
  email: 'creator@p3md.local',
  permissions: ['calendar.write']
};

mock.module('@/lib/auth/session', () => ({
  getSession: () => Promise.resolve(mockSessionUser)
}));

mock.module('@/lib/auth/require', () => ({
  requirePermission: (key: string) => {
    if (!mockSessionUser) throw new Error('Unauthorized');
    if (!mockSessionUser.permissions.includes(key)) throw new Error(`Forbidden: missing ${key}`);
    return Promise.resolve(mockSessionUser);
  }
}));

const fakeSupabase = () => ({
  from: (table: string) => ({
    insert: (payload: unknown) => {
      if (table === 'events') {
        const p = payload as Omit<InsertedEvent, 'id'>;
        const newEvent: InsertedEvent = { id: `event-${nextEventId++}`, ...p };
        insertedEvents.push(newEvent);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: newEvent.id }, error: null })
          })
        };
      }
      if (table === 'event_audience') {
        const rows = (Array.isArray(payload) ? payload : [payload]) as AudienceRow[];
        for (const r of rows) audienceRows.push(r);
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ error: null });
    },
    update: (patch: Partial<InsertedEvent>) => ({
      eq: (col1: string, val1: unknown) => ({
        eq: (col2: string, val2: unknown) => ({
          eq: (col3: string, val3: unknown) => ({
            select: () => ({
              maybeSingle: () => {
                const match = insertedEvents.find((e) => {
                  const row = e as unknown as Record<string, unknown>;
                  return row[col1] === val1 && row[col2] === val2 && row[col3] === val3;
                });
                if (!match) return Promise.resolve({ data: null, error: null });
                Object.assign(match, patch);
                return Promise.resolve({ data: { id: match.id }, error: null });
              }
            })
          })
        })
      })
    }),
    delete: () => ({
      eq: (col: string, val: unknown) => {
        if (table === 'event_audience') {
          audienceRows = audienceRows.filter((a) => (a as unknown as Record<string, unknown>)[col] !== val);
          return Promise.resolve({ error: null });
        }
        return Promise.resolve({ error: null });
      }
    })
  })
});

mock.module('@/lib/supabase/server', () => ({
  createClient: () => fakeSupabase()
}));

const { createEventAction, updateEventAction } = await import('./actions');

const USER_A = '11111111-1111-4111-8111-111111111111';
const ROLE_A = '22222222-2222-4222-8222-222222222222';
const GROUP_A = '33333333-3333-4333-8333-333333333333';

function baseInput(overrides: Partial<EventFormInput> = {}): EventFormInput {
  return {
    title: 'Sprint planning',
    description: null,
    location: null,
    starts_at: '2026-10-01T01:00:00.000Z',
    ends_at: '2026-10-01T02:00:00.000Z',
    all_day: false,
    rrule: null,
    audience: [{ user_id: USER_A }, { role_id: ROLE_A }, { group_id: GROUP_A }],
    ...overrides
  };
}

describe('PSI-042: createEventAction', () => {
  beforeEach(() => {
    insertedEvents = [];
    audienceRows = [];
    nextEventId = 1;
    mockSessionUser = {
      userId: 'user-creator-123',
      email: 'creator@p3md.local',
      permissions: ['calendar.write']
    };
  });

  test('creates an app event and inserts the full mixed audience in one call', async () => {
    const res = await createEventAction(baseInput());
    expect(res.ok).toBe(true);
    expect(res.eventId).toBeDefined();

    const event = insertedEvents.find((e) => e.id === res.eventId);
    expect(event?.title).toBe('Sprint planning');
    expect(event?.source).toBe('app');
    expect(event?.created_by).toBe('user-creator-123');

    const rows = audienceRows.filter((a) => a.event_id === res.eventId);
    expect(rows.length).toBe(3);
    expect(rows.some((r) => r.user_id === USER_A)).toBe(true);
    expect(rows.some((r) => r.role_id === ROLE_A)).toBe(true);
    expect(rows.some((r) => r.group_id === GROUP_A)).toBe(true);
  });

  test('rejects without calendar.write', async () => {
    mockSessionUser = { userId: 'user-viewer', email: 'v@p3md.local', permissions: [] };
    const res = await createEventAction(baseInput());
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Forbidden|calendar\.write/i);
    expect(insertedEvents.length).toBe(0);
  });

  test('rejects an end time before the start time', async () => {
    const res = await createEventAction(
      baseInput({ starts_at: '2026-10-01T02:00:00.000Z', ends_at: '2026-10-01T01:00:00.000Z' })
    );
    expect(res.ok).toBe(false);
    expect(insertedEvents.length).toBe(0);
  });

  test('creates an event with no audience (private to the creator)', async () => {
    const res = await createEventAction(baseInput({ audience: [] }));
    expect(res.ok).toBe(true);
    expect(audienceRows.filter((a) => a.event_id === res.eventId).length).toBe(0);
  });
});

describe('PSI-042: updateEventAction', () => {
  beforeEach(() => {
    insertedEvents = [];
    audienceRows = [];
    nextEventId = 1;
    mockSessionUser = {
      userId: 'user-creator-123',
      email: 'creator@p3md.local',
      permissions: ['calendar.write']
    };
  });

  test('replaces the audience wholesale on edit', async () => {
    const created = await createEventAction(baseInput());
    const eventId = created.eventId!;
    expect(audienceRows.filter((a) => a.event_id === eventId).length).toBe(3);

    const res = await updateEventAction(
      eventId,
      baseInput({ title: 'Sprint planning (moved)', audience: [{ user_id: USER_A }] })
    );
    expect(res.ok).toBe(true);

    const rows = audienceRows.filter((a) => a.event_id === eventId);
    expect(rows.length).toBe(1);
    expect(rows[0].user_id).toBe(USER_A);

    const event = insertedEvents.find((e) => e.id === eventId);
    expect(event?.title).toBe('Sprint planning (moved)');
  });

  test('fails when the event was not created by the caller', async () => {
    const created = await createEventAction(baseInput());
    mockSessionUser = { userId: 'someone-else', email: 'x@p3md.local', permissions: ['calendar.write'] };

    const res = await updateEventAction(created.eventId!, baseInput());
    expect(res.ok).toBe(false);
  });
});
