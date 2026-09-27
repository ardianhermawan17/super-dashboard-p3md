import { describe, expect, test } from 'bun:test';
import { entrySchema, categorySchema } from './types';
import { formatIDR, formatDateWIB } from './lib/format';

describe('entrySchema', () => {
  const base = {
    boardId: 'a1000000-0000-4000-8000-000000000001',
    categoryId: 'a1000000-0000-4000-8000-000000000002',
    direction: 'outflow' as const,
    amount: '250000',
    description: 'Venue deposit',
    occurredOn: '2026-09-27'
  };

  test('accepts a valid entry', () => {
    expect(entrySchema.safeParse(base).success).toBe(true);
  });

  test('rejects a zero amount', () => {
    const result = entrySchema.safeParse({ ...base, amount: '0' });
    expect(result.success).toBe(false);
  });

  test('rejects a negative amount', () => {
    const result = entrySchema.safeParse({ ...base, amount: '-100' });
    expect(result.success).toBe(false);
  });

  test('rejects an amount with more than 2 decimal places', () => {
    const result = entrySchema.safeParse({ ...base, amount: '100.999' });
    expect(result.success).toBe(false);
  });

  test('accepts an amount with up to 2 decimal places', () => {
    expect(entrySchema.safeParse({ ...base, amount: '100.50' }).success).toBe(true);
  });

  test('rejects a missing description', () => {
    const result = entrySchema.safeParse({ ...base, description: '' });
    expect(result.success).toBe(false);
  });

  test('rejects an invalid direction', () => {
    const result = entrySchema.safeParse({ ...base, direction: 'sideways' });
    expect(result.success).toBe(false);
  });

  test('taskId is optional', () => {
    expect(entrySchema.safeParse(base).success).toBe(true);
    expect(
      entrySchema.safeParse({ ...base, taskId: 'a1000000-0000-4000-8000-000000000003' }).success
    ).toBe(true);
  });
});

describe('categorySchema', () => {
  test('accepts a valid category with no direction (usable both ways)', () => {
    expect(categorySchema.safeParse({ name: 'Venue', slug: 'venue' }).success).toBe(true);
  });

  test('rejects an uppercase slug', () => {
    const result = categorySchema.safeParse({ name: 'Venue', slug: 'Venue' });
    expect(result.success).toBe(false);
  });

  test('rejects a slug with spaces', () => {
    const result = categorySchema.safeParse({ name: 'Venue', slug: 'venue hall' });
    expect(result.success).toBe(false);
  });
});

describe('formatIDR', () => {
  test('formats a whole-number decimal string with no decimals', () => {
    expect(formatIDR('2000000.00')).toBe('Rp 2.000.000');
  });

  test('rounds a fractional amount to whole rupiah', () => {
    expect(formatIDR('1500.50')).toBe('Rp 1.501');
  });

  test('falls back to Rp 0 for a non-numeric string', () => {
    expect(formatIDR('not-a-number')).toBe('Rp 0');
  });
});

describe('formatDateWIB', () => {
  test('formats a date-only string as day/month/year', () => {
    expect(formatDateWIB('2026-09-27')).toBe('27 Sep 2026');
  });
});
