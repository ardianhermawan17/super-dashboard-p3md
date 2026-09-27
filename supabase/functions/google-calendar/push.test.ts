// supabase/functions/google-calendar/push.test.ts
// Unit tests for Google Calendar /push endpoint: event mapper, deterministic IDs,
// audience reconciliation, and idempotency.
// Spec: docs/backend-architecture/google-integration.md § "/push: app -> Google"

import { describe, expect, test } from 'bun:test';
import { toGoogleEvent, reconcilePush } from './push';

describe('Google Calendar Event Push (PSI-066)', () => {
  const eventId = '550e8400-e29b-41d4-a716-446655440000';
  const expectedGid = '550e8400e29b41d4a716446655440000'; // hex without dashes

  const baseEvent = {
    id: eventId,
    title: 'Board Sync',
    description: 'Review roadmap',
    location: 'Virtual',
    starts_at: '2026-10-05T09:00:00+07:00',
    ends_at: '2026-10-05T10:00:00+07:00',
    all_day: false,
    rrule: null,
  };

  test('deterministic google event id removes dashes from uuid', () => {
    const ev = { ...baseEvent, description: 'Review roadmap' };

    const gEvent = toGoogleEvent(ev);
    expect(gEvent.id).toBe(expectedGid);
    expect(gEvent.summary).toBe('Board Sync');
    expect(gEvent.description).toContain('Managed in P3MD');
    expect(gEvent.location).toBe('Virtual');
    expect(gEvent.start).toEqual({ dateTime: '2026-10-05T09:00:00+07:00', timeZone: 'Asia/Jakarta' });
    expect(gEvent.end).toEqual({ dateTime: '2026-10-05T10:00:00+07:00', timeZone: 'Asia/Jakarta' });
    expect(gEvent.extendedProperties?.private?.p3md_event_id).toBe(eventId);
    expect(gEvent.recurrence).toBeUndefined();
  });

  test('all-day event formats start and end as YYYY-MM-DD dates', () => {
    const ev = { ...baseEvent, all_day: true, starts_at: '2026-12-25T00:00:00+07:00', ends_at: '2026-12-25T23:59:59+07:00' };

    const gEvent = toGoogleEvent(ev);
    expect(gEvent.start).toEqual({ date: '2026-12-25' });
    expect(gEvent.end).toEqual({ date: '2026-12-25' });
  });

  test('adds RRULE: prefix when rrule is present', () => {
    const ev = { ...baseEvent, rrule: 'FREQ=WEEKLY;BYDAY=MO' };

    const gEvent = toGoogleEvent(ev);
    expect(gEvent.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO']);
  });

  test('delete operation calls Google DELETE for every passed link', async () => {
    const deleted: string[] = [];
    const mockGfetch = async (_scope: string, url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        deleted.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const links = [
      { google_calendar_id: 'cal1@group.calendar.google.com', google_event_id: expectedGid },
      { google_calendar_id: 'cal2@group.calendar.google.com', google_event_id: expectedGid },
    ];

    const res = await reconcilePush({
      op: 'delete',
      eventId,
      links,
      gfetchFn: mockGfetch,
    });

    expect(res.deleted).toBe(2);
    expect(deleted.length).toBe(2);
    expect(deleted[0]).toContain('cal1%40group.calendar.google.com/events/' + expectedGid);
  });

  test('delete treats a 404 as success (already gone)', async () => {
    const mockGfetch = async (_scope: string, _url: string, _init?: RequestInit) => new Response('gone', { status: 404 });

    const res = await reconcilePush({
      op: 'delete',
      eventId,
      links: [{ google_calendar_id: 'cal@group.calendar.google.com', google_event_id: expectedGid }],
      gfetchFn: mockGfetch,
    });

    expect(res.deleted).toBe(1);
    expect(res.errors).toBeUndefined();
  });

  test('upsert pushes to a desired calendar via POST then PUTs on 409 (idempotent)', async () => {
    const calls: Array<{ method: string; url: string }> = [];
    let postCount = 0;
    const htmlLink = 'https://calendar.google.com/event?eid=abc';

    const mockGfetch = async (_scope: string, url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? 'GET', url });
      if (init?.method === 'POST') {
        postCount++;
        if (postCount === 1) {
          return new Response('conflict', { status: 409 });
        }
      }
      return new Response(JSON.stringify({ htmlLink }), { status: 200 });
    };

    const upsertedLinks: unknown[] = [];
    const calendars = [
      { id: 'c1', calendar_id: 'team@group.calendar.google.com', name: 'Team', direction: 'push' as const, role_id: 'role-1', group_id: null, enabled: true },
    ];
    const audience = [{ event_id: eventId, user_id: null, role_id: 'role-1', group_id: null }];

    const res = await reconcilePush({
      op: 'upsert',
      eventId,
      event: baseEvent,
      audience,
      calendars,
      gfetchFn: mockGfetch,
      upsertLinkFn: async (link) => { upsertedLinks.push(link); },
    });

    // POST (409) -> PUT -> success
    expect(calls[0].method).toBe('POST');
    expect(calls[1].method).toBe('PUT');
    expect(res.pushed).toBe(1);
    expect(res.errors).toBeUndefined();
    expect(upsertedLinks.length).toBe(1);
    expect(upsertedLinks[0]).toMatchObject({ google_calendar_id: 'team@group.calendar.google.com', google_event_id: expectedGid, html_link: htmlLink });
  });

  test('upsert skips calendars that do not match the audience role/group', async () => {
    let postCount = 0;
    const mockGfetch = async (_scope: string, _url: string, init?: RequestInit) => {
      if (init?.method === 'POST') postCount++;
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const calendars = [
      { id: 'c1', calendar_id: 'role-cal@group.calendar.google.com', name: 'Role cal', direction: 'push' as const, role_id: 'role-1', group_id: null, enabled: true },
      { id: 'c2', calendar_id: 'other-cal@group.calendar.google.com', name: 'Other cal', direction: 'push' as const, role_id: 'role-2', group_id: null, enabled: true },
    ];
    const audience = [{ event_id: eventId, user_id: null, role_id: 'role-1', group_id: null }];

    const res = await reconcilePush({
      op: 'upsert',
      eventId,
      event: baseEvent,
      audience,
      calendars,
      gfetchFn: mockGfetch,
    });

    expect(postCount).toBe(1); // only role-cal matched
    expect(res.pushed).toBe(1);
  });

  test('upsert with a user-only audience pushes nowhere', async () => {
    let postCount = 0;
    const mockGfetch = async (_scope: string, _url: string, init?: RequestInit) => {
      if (init?.method === 'POST') postCount++;
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const calendars = [
      { id: 'c1', calendar_id: 'team@group.calendar.google.com', name: 'Team', direction: 'push' as const, role_id: 'role-1', group_id: null, enabled: true },
    ];
    const audience = [{ event_id: eventId, user_id: 'user-9', role_id: null, group_id: null }];

    const res = await reconcilePush({
      op: 'upsert',
      eventId,
      event: baseEvent,
      audience,
      calendars,
      gfetchFn: mockGfetch,
    });

    expect(postCount).toBe(0);
    expect(res.pushed).toBe(0);
  });

  test('upsert cleans up existing links for calendars no longer in audience', async () => {
    const deletedUrls: string[] = [];
    const deletedInDb: string[] = [];

    const mockGfetch = async (_scope: string, url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        deletedUrls.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    };

    // Calendar was unlinked or audience changed
    const calendars = [
      { id: 'c1', calendar_id: 'active@group.calendar.google.com', name: 'Active', direction: 'push' as const, role_id: 'role-1', group_id: null, enabled: true },
    ];
    const audience = [{ event_id: eventId, user_id: null, role_id: 'role-1', group_id: null }];
    const existingLinks = [
      { google_calendar_id: 'active@group.calendar.google.com', google_event_id: expectedGid },
      { google_calendar_id: 'stale@group.calendar.google.com', google_event_id: expectedGid },
    ];

    const res = await reconcilePush({
      op: 'upsert',
      eventId,
      event: baseEvent,
      audience,
      calendars,
      links: existingLinks,
      gfetchFn: mockGfetch,
      deleteLinkFn: async (calId) => { deletedInDb.push(calId); },
    });

    expect(res.pushed).toBe(1);
    expect(res.deleted).toBe(1);
    expect(deletedUrls.length).toBe(1);
    expect(deletedUrls[0]).toContain('stale%40group.calendar.google.com');
    expect(deletedInDb).toEqual(['stale@group.calendar.google.com']);
  });
});
