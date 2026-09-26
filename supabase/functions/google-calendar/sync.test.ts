// supabase/functions/google-calendar/sync.test.ts
// Unit tests for Google Calendar event mapping, recurrence, all-day conversion, and filters.

import { describe, expect, test } from 'bun:test';
import { mapGoogleEvent } from './mapper';

describe('Google Calendar Event Mapper (PSI-065)', () => {
  const calId = 'test-calendar@group.calendar.google.com';

  test('maps standard timed event correctly', () => {
    const item = {
      id: 'google_evt_001',
      summary: 'Executive Meeting',
      description: 'Review Q3 goals',
      location: 'HQ Room 402',
      htmlLink: 'https://calendar.google.com/event?eid=123',
      start: { dateTime: '2026-10-01T10:00:00+07:00' },
      end: { dateTime: '2026-10-01T11:00:00+07:00' },
    };

    const mapped = mapGoogleEvent(calId, item);
    expect(mapped).not.toBeNull();
    expect(mapped?.calendar_id).toBe(calId);
    expect(mapped?.google_event_id).toBe('google_evt_001');
    expect(mapped?.title).toBe('Executive Meeting');
    expect(mapped?.description).toBe('Review Q3 goals');
    expect(mapped?.location).toBe('HQ Room 402');
    expect(mapped?.starts_at).toBe('2026-10-01T10:00:00+07:00');
    expect(mapped?.ends_at).toBe('2026-10-01T11:00:00+07:00');
    expect(mapped?.all_day).toBe(false);
    expect(mapped?.html_link).toBe('https://calendar.google.com/event?eid=123');
  });

  test('maps all-day event to Asia/Jakarta 00:00:00 timestamp', () => {
    const item = {
      id: 'google_evt_002',
      summary: 'Public Holiday',
      start: { date: '2026-10-05' },
      end: { date: '2026-10-06' },
    };

    const mapped = mapGoogleEvent(calId, item);
    expect(mapped).not.toBeNull();
    expect(mapped?.all_day).toBe(true);
    expect(mapped?.starts_at).toBe('2026-10-05T00:00:00+07:00');
    expect(mapped?.ends_at).toBe('2026-10-06T00:00:00+07:00');
  });

  test('skips cancelled events', () => {
    const item = {
      id: 'google_evt_003',
      status: 'cancelled',
      summary: 'Old Meeting',
      start: { dateTime: '2026-10-01T10:00:00Z' },
    };

    const mapped = mapGoogleEvent(calId, item);
    expect(mapped).toBeNull();
  });

  test('skips events pushed by our app (loop prevention)', () => {
    const item = {
      id: 'google_evt_004',
      summary: 'App Created Event',
      start: { dateTime: '2026-10-01T10:00:00Z' },
      extendedProperties: {
        private: {
          p3md_event_id: '11111111-1111-1111-1111-111111111111',
        },
      },
    };

    const mapped = mapGoogleEvent(calId, item);
    expect(mapped).toBeNull();
  });

  test('strips RRULE: prefix when mapping recurrence', () => {
    const item = {
      id: 'google_evt_005',
      summary: 'Weekly Standup',
      start: { dateTime: '2026-10-01T09:00:00+07:00' },
      end: { dateTime: '2026-10-01T09:30:00+07:00' },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'],
    };

    const mapped = mapGoogleEvent(calId, item);
    expect(mapped).not.toBeNull();
    expect(mapped?.rrule).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  test('handles empty title with fallback', () => {
    const item = {
      id: 'google_evt_006',
      summary: '   ',
      start: { dateTime: '2026-10-01T09:00:00Z' },
    };

    const mapped = mapGoogleEvent(calId, item);
    expect(mapped?.title).toBe('(No Title)');
  });
});
