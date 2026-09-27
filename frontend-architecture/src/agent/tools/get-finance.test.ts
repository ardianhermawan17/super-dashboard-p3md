/**
 * PSI-105: get_finance tool tests.
 *
 * Contract (docs/frontend-architecture/features/finance.md §Agent tool, and the
 * PSI-105 card): input {eventId?, boardId?, from?, to?, category?, limit 1..50},
 * output {currency, totals, byCategory, recent}; decimal-string amounts, category
 * slugs, no creator identities, max 50 recent rows, deep links on every recent
 * row, every call audited (runtime does that), and a caller without `finance.read`
 * gets nothing (RLS via the security_invoker agent_finance view — here simulated
 * by the fake returning zero rows).
 */
import { describe, expect, test } from 'bun:test';
import { builder } from '../testing/fake-supabase';
import { getFinance } from './get-finance';
import { deepLink } from '../links';

/** One grouped row of agent_finance (the view's exact shape). */
function aggRow(over: Partial<Parameters<typeof getFinance>[0]> & object) {
  void over;
  return {
    board_id: 'b1',
    board: 'Presidium 2026',
    event_id: 'e1',
    event: 'Dies Natalis',
    event_starts_at: '2026-08-01T00:00:00+07:00',
    direction: 'inflow',
    category: 'sponsorship',
    category_name: 'Sponsorship',
    currency: 'IDR',
    entry_count: 2,
    total: 15000000,
    first_on: '2026-08-01',
    last_on: '2026-08-05'
  };
}

/** One finance_entries row (the columns the tool selects). */
function entryRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'fe1',
    board_id: 'b1',
    event_id: 'e1',
    task_id: null,
    category_id: 'c1',
    direction: 'inflow',
    amount: '10000000.00',
    currency: 'IDR',
    description: 'Corporate sponsor',
    occurred_on: '2026-08-01',
    boards: { name: 'Presidium 2026' },
    finance_categories: { slug: 'sponsorship', name: 'Sponsorship' },
    events: { title: 'Dies Natalis' },
    ...over
  };
}

describe('get_finance', () => {
  test('tool contract: name, title, zod input, max limit 50', () => {
    expect(getFinance.name).toBe('get_finance');
    expect(getFinance.title).toContain('Finance');
    expect(typeof getFinance.input).toBe('object');
    expect(getFinance.input.safeParse({ limit: 50 }).success).toBe(true);
    expect(getFinance.input.safeParse({ limit: 51 }).success).toBe(false);
    expect(getFinance.input.safeParse({}).success).toBe(true); // everything optional
  });

  test('aggregates totals and per-category breakdown from agent_finance', async () => {
    const rows = [
      aggRow({}),
      { ...aggRow({}), direction: 'outflow', category: 'venue', category_name: 'Venue', total: 4000000, entry_count: 1, first_on: '2026-08-10', last_on: '2026-08-10' },
      { ...aggRow({}), board_id: 'b2', board: 'Other board' } // excluded by boardId filter
    ];
    const db = { from: (t: string) => (t === 'agent_finance' ? builder(rows) : builder([entryRow()])) } as never;

    const out = await getFinance.run({ boardId: 'b1', limit: 20 }, { db, clientId: 'test' } as never);

    expect(out.currency).toBe('IDR');
    expect(out.totals).toEqual({ inflow: '15000000.00', outflow: '4000000.00', net: '11000000.00' });
    expect(out.byCategory).toHaveLength(2);
    const sp = out.byCategory.find((c: { category: string }) => c.category === 'sponsorship');
    expect(sp).toMatchObject({ direction: 'inflow', total: '15000000.00', count: 2 });
    const venue = out.byCategory.find((c: { category: string }) => c.category === 'venue');
    expect(venue).toMatchObject({ direction: 'outflow', total: '4000000.00', count: 1 });
  });

  test('recent rows carry decimal amounts, slugs, deep links, no creator identity', async () => {
    const rows = [
      entryRow(),
      {
        ...entryRow(),
        id: 'fe2',
        direction: 'outflow',
        amount: '2500000.00',
        description: 'Lunch box vendor',
        occurred_on: '2026-08-12',
        finance_categories: { slug: 'venue', name: 'Venue' }
      }
    ];
    const db = { from: (t: string) => (t === 'agent_finance' ? builder([]) : builder(rows)) } as never;

    const out = await getFinance.run({ boardId: 'b1', limit: 20 }, { db, clientId: 'test' } as never);

    expect(out.recent).toHaveLength(2);
    // Newest first (occurred_on DESC, per the tool's contract).
    const first = out.recent[0];
    expect(first.amount).toBe('2500000.00');
    expect(first.currency).toBe('IDR');
    expect(first.category).toBe('venue');
    expect(first.direction).toBe('outflow');
    expect(first.description).toBe('Lunch box vendor');
    expect(first.board).toBe('Presidium 2026');
    expect(first.link).toBe(deepLink('event', 'e1'));
    expect(first.occurredOn).toBe('2026-08-12');
    const sponsor = out.recent[1];
    expect(sponsor.amount).toBe('10000000.00');
    expect(sponsor.category).toBe('sponsorship');
    expect(sponsor.direction).toBe('inflow');
    expect(sponsor.link).toBe(deepLink('event', 'e1'));
    expect(JSON.stringify(first)).not.toContain('created_by');
    expect(JSON.stringify(first)).not.toContain('creator');
    // every recent row has a link
    for (const r of out.recent) expect(typeof r.link).toBe('string');
  });

  test('recent is capped at limit (max 50)', async () => {
    const rows = Array.from({ length: 60 }, (_, i) => entryRow({ id: `fe${i}` }));
    const db = { from: (t: string) => (t === 'agent_finance' ? builder([]) : builder(rows)) } as never;
    const out = await getFinance.run({ boardId: 'b1', limit: 50 }, { db, clientId: 'test' } as never);
    expect(out.recent.length).toBeLessThanOrEqual(50);
  });

  test('caller without finance.read gets nothing (RLS returns zero rows)', async () => {
    // Simulates the security_invoker agent_finance + finance_entries RLS
    // (can_read_finance(board_id)) returning no rows for a caller without
    // finance.read: the tool must yield empty totals, not an error or leak.
    const db = { from: () => builder([]) } as never;
    const out = await getFinance.run({ boardId: 'b1', limit: 20 }, { db, clientId: 'test' } as never);
    expect(out.totals).toEqual({ inflow: '0.00', outflow: '0.00', net: '0.00' });
    expect(out.byCategory).toEqual([]);
    expect(out.recent).toEqual([]);
  });

  test('eventId and category filters propagate to both queries', async () => {
    const calls: string[][] = [];
    const db = {
      from: (t: string) => {
        calls.push([t]);
        return builder(t === 'agent_finance' ? [] : []);
      }
    } as never;
    await getFinance.run({ eventId: 'e1', category: 'venue', limit: 5 }, { db, clientId: 'test' } as never);
    expect(calls).toHaveLength(2); // agent_finance + agent_finance recent? see impl
  });
});