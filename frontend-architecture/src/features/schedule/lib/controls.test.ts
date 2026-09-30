// frontend-architecture/src/features/schedule/lib/controls.test.ts
// PSI-120 · the URL controls (?target=<days>&k=<1|2|3>&unit=<day|week>&view=<Day|Week|Month>) and the
// two headline strings the design fixes: "TE 35 w ± 5.9 w (k=2)" and "P(finish ≤ 38 w) = 84.6 %".
//
// Parsing is pure so the same rules apply on the server (reading searchParams) and on the client.

import { describe, expect, test } from 'bun:test';
import { computeSchedule } from './pert';
import {
  DEFAULT_SCHEDULE_CONTROLS,
  formatRangeHeadline,
  formatTargetProbability,
  parseScheduleControls
} from './controls';

const W = 7;
const tasks = [
  { id: 'A', a: 4 * W, m: 8 * W, b: 12 * W },
  { id: 'B', a: 6 * W, m: 9 * W, b: 18 * W },
  { id: 'C', a: 5 * W, m: 6 * W, b: 7 * W },
  { id: 'D', a: 10 * W, m: 12 * W, b: 20 * W },
  { id: 'E', a: 3 * W, m: 4 * W, b: 5 * W }
];
const links = [
  { from: 'A', to: 'B' },
  { from: 'A', to: 'C' },
  { from: 'B', to: 'D' },
  { from: 'C', to: 'D' },
  { from: 'D', to: 'E' }
];
const result = computeSchedule(tasks, links);
if (!result.ok) throw new Error('fixture must compute');
const schedule = result.value;

describe('parseScheduleControls', () => {
  test('empty params give the documented defaults', () => {
    expect(DEFAULT_SCHEDULE_CONTROLS).toEqual({
      targetDays: null,
      k: 2,
      unit: 'week',
      view: 'Week'
    });
    expect(parseScheduleControls({})).toEqual(DEFAULT_SCHEDULE_CONTROLS);
  });

  test('reads all four params', () => {
    const got = parseScheduleControls({ target: '266', k: '3', unit: 'day', view: 'Month' });
    expect(got).toEqual({ targetDays: 266, k: 3, unit: 'day', view: 'Month' });
  });

  test('accepts the array form Next gives for repeated params, taking the first', () => {
    expect(parseScheduleControls({ k: ['1', '3'], view: ['Day', 'Month'] })).toMatchObject({
      k: 1,
      view: 'Day'
    });
  });

  test('falls back on garbage instead of throwing', () => {
    const got = parseScheduleControls({ target: 'abc', k: '9', unit: 'fortnight', view: 'Year' });
    expect(got).toEqual(DEFAULT_SCHEDULE_CONTROLS);
  });

  test('rejects a non-positive or non-finite target but keeps the rest', () => {
    expect(parseScheduleControls({ target: '0', k: '1' })).toMatchObject({
      targetDays: null,
      k: 1
    });
    expect(parseScheduleControls({ target: '-5' })).toMatchObject({ targetDays: null });
    expect(parseScheduleControls({ target: 'Infinity' })).toMatchObject({ targetDays: null });
    expect(parseScheduleControls({ target: '38.5' })).toMatchObject({ targetDays: 38.5 });
  });

  test('uses the caller fallback only when the URL has no usable target', () => {
    expect(parseScheduleControls({}, { fallbackTargetDays: 266 })).toMatchObject({
      targetDays: 266
    });
    expect(parseScheduleControls({ target: '100' }, { fallbackTargetDays: 266 })).toMatchObject({
      targetDays: 100
    });
    expect(parseScheduleControls({ target: 'nope' }, { fallbackTargetDays: 266 })).toMatchObject({
      targetDays: 266
    });
    expect(parseScheduleControls({}, { fallbackTargetDays: -3 })).toMatchObject({
      targetDays: null
    });
  });
});

describe('formatRangeHeadline', () => {
  test('is "TE 35 w ± 5.9 w (k=2)" on the fixture, in weeks', () => {
    expect(formatRangeHeadline(schedule, { k: 2, unit: 'week' })).toBe('TE 35 w ± 5.9 w (k=2)');
  });

  test('k is echoed, so 1σ and 3σ read differently', () => {
    expect(formatRangeHeadline(schedule, { k: 1, unit: 'week' })).toBe('TE 35 w ± 2.9 w (k=1)');
    expect(formatRangeHeadline(schedule, { k: 3, unit: 'week' })).toBe('TE 35 w ± 8.8 w (k=3)');
  });

  test('switches to days without re-deriving the numbers', () => {
    expect(formatRangeHeadline(schedule, { k: 2, unit: 'day' })).toBe('TE 245 d ± 41.2 d (k=2)');
  });
});

describe('formatTargetProbability', () => {
  test('is "P(finish ≤ 38 w) = 84.6 %" for the fixture target', () => {
    expect(formatTargetProbability(schedule, { targetDays: 38 * W, unit: 'week' })).toBe(
      'P(finish ≤ 38 w) = 84.6 %'
    );
  });

  test('says nothing at all when no target is set', () => {
    expect(formatTargetProbability(schedule, { targetDays: null, unit: 'week' })).toBeNull();
  });

  test('reads in the chosen unit', () => {
    expect(formatTargetProbability(schedule, { targetDays: 38 * W, unit: 'day' })).toBe(
      'P(finish ≤ 266 d) = 84.6 %'
    );
  });

  test('a target equal to TE is a coin flip, and the tails saturate', () => {
    expect(formatTargetProbability(schedule, { targetDays: 35 * W, unit: 'week' })).toBe(
      'P(finish ≤ 35 w) = 50.0 %'
    );
    expect(formatTargetProbability(schedule, { targetDays: 10 * W, unit: 'week' })).toBe(
      'P(finish ≤ 10 w) = 0.0 %'
    );
    expect(formatTargetProbability(schedule, { targetDays: 60 * W, unit: 'week' })).toBe(
      'P(finish ≤ 60 w) = 100.0 %'
    );
  });
});
