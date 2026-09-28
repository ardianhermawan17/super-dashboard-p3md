import { describe, expect, test } from 'bun:test';
import { expandRecurringEvents } from './recurrence';
import type { CalendarEvent } from '../types';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1',
    title: 'Weekly standup',
    description: null,
    location: null,
    starts_at: '2026-10-01T01:00:00.000Z', // 08:00 WIB
    ends_at: '2026-10-01T01:30:00.000Z',
    all_day: false,
    rrule: null,
    source: 'app',
    created_by: 'user-1',
    created_at: '2026-09-01T00:00:00.000Z',
    ...overrides
  };
}

describe('expandRecurringEvents', () => {
  test('passes non-recurring events through unchanged', () => {
    const event = makeEvent();
    const result = expandRecurringEvents(
      [event],
      new Date('2026-09-25T00:00:00Z'),
      new Date('2026-10-10T00:00:00Z')
    );
    expect(result).toEqual([event]);
  });

  test('expands a weekly rrule into one instance per occurrence in range, preserving duration', () => {
    const event = makeEvent({ rrule: 'FREQ=WEEKLY;COUNT=4' });
    const result = expandRecurringEvents(
      [event],
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-31T00:00:00Z')
    );

    expect(result.length).toBe(4);
    expect(result.every((e) => e.title === 'Weekly standup')).toBe(true);
    // Each occurrence is one week apart and keeps the 30-minute duration.
    for (const occ of result) {
      const durationMs = new Date(occ.ends_at).getTime() - new Date(occ.starts_at).getTime();
      expect(durationMs).toBe(30 * 60 * 1000);
    }
    const starts = result.map((e) => new Date(e.starts_at).getTime()).toSorted();
    expect(starts[1] - starts[0]).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('gives each occurrence a unique id derived from the base event', () => {
    const event = makeEvent({ rrule: 'FREQ=DAILY;COUNT=3' });
    const result = expandRecurringEvents(
      [event],
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-05T00:00:00Z')
    );
    expect(result.length).toBe(3);
    expect(new Set(result.map((e) => e.id)).size).toBe(3);
    expect(result.every((e) => e.id.startsWith('event-1__'))).toBe(true);
  });

  test('excludes occurrences outside the visible range', () => {
    const event = makeEvent({ rrule: 'FREQ=WEEKLY;COUNT=52' });
    const result = expandRecurringEvents(
      [event],
      new Date('2026-10-01T00:00:00Z'),
      new Date('2026-10-08T02:00:00Z')
    );
    expect(result.length).toBe(2); // Oct 1 and Oct 8 occurrences fall inside; the rest do not
  });

  test('falls back to the single stored occurrence for a malformed rrule instead of dropping it', () => {
    const event = makeEvent({ rrule: 'NOT;A;VALID;RRULE' });
    const result = expandRecurringEvents(
      [event],
      new Date('2026-09-25T00:00:00Z'),
      new Date('2026-10-10T00:00:00Z')
    );
    expect(result).toEqual([event]);
  });
});
