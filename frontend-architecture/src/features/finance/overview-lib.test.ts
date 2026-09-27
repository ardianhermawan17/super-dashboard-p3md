/**
 * PSI-106: Finance charts on the overview.
 *
 * Tests the pure aggregation behind getFinanceOverviewAction — monthly
 * inflow/outflow series (last 6 months, zero-filled) and outflow by category
 * (top N + Other). The action itself is a thin RLS-scoped fetch + this.
 */
import { describe, expect, test } from 'bun:test';
import {
  aggregateFinanceOverview,
  type FinanceRow,
} from './overview-lib';

const row = (over: Partial<FinanceRow>) => ({
  direction: 'inflow',
  amount: '1000000.00',
  occurred_on: '2026-08-05',
  category_slug: 'sponsorship',
  category_name: 'Sponsorship',
  ...over,
});

describe('aggregateFinanceOverview', () => {
  test('zero-fills the last 6 months when there is no data', () => {
    const out = aggregateFinanceOverview([], { now: new Date('2026-09-01T12:00:00Z') });
    expect(out.monthly).toHaveLength(6);
    expect(out.monthly.map((m) => m.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    for (const m of out.monthly) {
      expect(m.inflow).toBe('0.00');
      expect(m.outflow).toBe('0.00');
    }
    expect(out.outflowByCategory).toEqual([]);
  });

  test('aggregates monthly inflow and outflow as decimal strings', () => {
    const out = aggregateFinanceOverview(
      [
        row({ direction: 'inflow', amount: '10000000.00', occurred_on: '2026-08-01' }),
        row({ direction: 'inflow', amount: '5000000.00', occurred_on: '2026-08-05' }),
        row({ direction: 'outflow', amount: '4000000.00', occurred_on: '2026-08-10' }),
        row({ direction: 'outflow', amount: '2500000.00', occurred_on: '2026-07-15' }),
      ],
      { now: new Date('2026-09-01T12:00:00Z') }
    );

    const aug = out.monthly.find((m) => m.month === '2026-08')!;
    expect(aug.inflow).toBe('15000000.00');
    expect(aug.outflow).toBe('4000000.00');
    const jul = out.monthly.find((m) => m.month === '2026-07')!;
    expect(jul.outflow).toBe('2500000.00');
    expect(jul.inflow).toBe('0.00');
  });

  test('buckets outflow by category slug, top N plus Other, sum preserved', () => {
    const rows = [
      // 3 categories, one dominates; plus a 4th small one that falls into Other
      row({ direction: 'outflow', amount: '5000000.00', occurred_on: '2026-08-01', category_slug: 'venue', category_name: 'Venue' }),
      row({ direction: 'outflow', amount: '1000000.00', occurred_on: '2026-08-02', category_slug: 'venue', category_name: 'Venue' }),
      row({ direction: 'outflow', amount: '2000000.00', occurred_on: '2026-08-03', category_slug: 'catering', category_name: 'Catering' }),
      row({ direction: 'outflow', amount: '500000.00', occurred_on: '2026-08-04', category_slug: 'marketing', category_name: 'Marketing' }),
      row({ direction: 'outflow', amount: '200000.00', occurred_on: '2026-08-05', category_slug: 'insurance', category_name: 'Insurance' }),
      // inflow must NOT be counted in outflowByCategory
      row({ direction: 'inflow', amount: '90000000.00', occurred_on: '2026-08-06', category_slug: 'sponsorship', category_name: 'Sponsorship' }),
    ];
    const out = aggregateFinanceOverview(rows, {
      now: new Date('2026-09-01T12:00:00Z'),
      topCategories: 2
    });

    // top 2 (venue 6M, catering 2M) + Other absorbs marketing (500k) + insurance (200k)
    const byCat = out.outflowByCategory;
    const venue = byCat.find((c) => c.slug === 'venue')!;
    expect(venue.total).toBe('6000000.00');
    const catering = byCat.find((c) => c.slug === 'catering')!;
    expect(catering.total).toBe('2000000.00');
    const other = byCat.find((c) => c.slug === 'other')!;
    // 500k + 200k
    expect(other.total).toBe('700000.00');

    // sum preserved = 6M + 2M + 0.7M
    const sum = byCat.reduce((acc, c) => acc + Number(c.total), 0);
    expect(sum).toBe(8700000);
  });

  test('top N slicing keeps the largest categories and Other takes the rest', () => {
    const rows = Array.from({ length: 8 }, (_, i) =>
      row({
        direction: 'outflow',
        amount: `${(i + 1) * 1000000}.00`,
        occurred_on: '2026-08-01',
        category_slug: `cat-${i}`,
        category_name: `Cat ${i}`,
      })
    );
    const out = aggregateFinanceOverview(rows, { now: new Date('2026-09-01T12:00:00Z'), topCategories: 3 });

    expect(out.outflowByCategory).toHaveLength(4); // 3 + Other
    expect(out.outflowByCategory[0].slug).toBe('cat-7'); // biggest (8M)
    expect(out.outflowByCategory[0].total).toBe('8000000.00');
    const other = out.outflowByCategory.find((c) => c.slug === 'other')!;
    // 1M+2M+3M+4M+5M = 15M
    expect(other.total).toBe('15000000.00');
  });
});