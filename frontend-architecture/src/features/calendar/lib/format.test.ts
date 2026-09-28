import { describe, expect, test } from 'bun:test';
import {
  formatEventDateTimeWIB,
  formatEventTimeWIB,
  getWibHour,
  isoToWibInputValue,
  wibInputValueToISO
} from './format';

describe('wibInputValueToISO / isoToWibInputValue', () => {
  test('round-trips a datetime-local value through WIB', () => {
    const iso = wibInputValueToISO('2026-10-01T14:30');
    expect(iso).toBe('2026-10-01T07:30:00.000Z'); // 14:30 WIB = 07:30 UTC
    expect(isoToWibInputValue(iso)).toBe('2026-10-01T14:30');
  });

  test('handles a WIB time that crosses the UTC day boundary', () => {
    // 02:00 WIB on Oct 2 is still Oct 1 in UTC.
    const iso = wibInputValueToISO('2026-10-02T02:00');
    expect(iso).toBe('2026-10-01T19:00:00.000Z');
    expect(isoToWibInputValue(iso)).toBe('2026-10-02T02:00');
  });
});

describe('getWibHour', () => {
  test('converts a UTC timestamp to its WIB hour-of-day', () => {
    expect(getWibHour('2026-10-01T01:00:00.000Z')).toBe(8);
    expect(getWibHour('2026-10-01T17:30:00.000Z')).toBe(0); // wraps past midnight WIB
  });
});

describe('formatEventTimeWIB / formatEventDateTimeWIB', () => {
  test('formats a UTC timestamp as WIB time', () => {
    expect(formatEventTimeWIB('2026-10-01T01:00:00.000Z')).toBe('08.00');
  });

  test('formats a UTC timestamp as a WIB date and time', () => {
    const result = formatEventDateTimeWIB('2026-10-01T01:00:00.000Z');
    expect(result).toContain('2026');
    expect(result).toContain('08.00');
  });
});
