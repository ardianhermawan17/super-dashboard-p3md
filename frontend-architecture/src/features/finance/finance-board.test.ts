// frontend-architecture/src/features/finance/finance-board.test.ts
// Unit tests for PSI-104: "Finance on event boards and events"
// Spec: docs/list-task-project.md line 653 & docs/frontend-architecture/features/finance.md

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Stub server-only for bun test environment
mock.module('server-only', () => ({}));

let mockSessionUser: {
  userId: string;
  email: string;
  permissions: string[];
} | null = {
  userId: 'user-treasurer-1',
  email: 'treasurer@p3md.local',
  permissions: ['finance.read', 'finance.write', 'kanban.write'],
};

mock.module('@/lib/auth/session', () => ({
  getSession: () => Promise.resolve(mockSessionUser),
}));

mock.module('@/lib/auth/require', () => ({
  requirePermission: (key: string) => {
    if (!mockSessionUser) throw new Error('Unauthorized');
    if (!mockSessionUser.permissions.includes(key)) throw new Error(`Forbidden: missing ${key}`);
    return Promise.resolve(mockSessionUser);
  },
}));

// Mock finance entries
const mockEntries = [
  {
    id: 'entry-1',
    board_id: 'board-pres-1',
    event_id: 'event-pres-1',
    task_id: 'task-stage-1',
    category_id: 'cat-sponsorship',
    direction: 'inflow',
    amount: 10000000.0,
    currency: 'IDR',
    description: 'Corporate sponsor',
    occurred_on: '2026-08-01',
    created_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'entry-2',
    board_id: 'board-pres-1',
    event_id: 'event-pres-1',
    task_id: null,
    category_id: 'cat-ticketing',
    direction: 'inflow',
    amount: 5000000.0,
    currency: 'IDR',
    description: 'Ticket sales wave 1',
    occurred_on: '2026-08-05',
    created_at: '2026-08-05T00:00:00Z',
  },
  {
    id: 'entry-3',
    board_id: 'board-pres-1',
    event_id: 'event-pres-1',
    task_id: 'task-stage-1',
    category_id: 'cat-venue',
    direction: 'outflow',
    amount: 4000000.0,
    currency: 'IDR',
    description: 'Hall booking',
    occurred_on: '2026-08-10',
    created_at: '2026-08-10T00:00:00Z',
  },
  {
    id: 'entry-4',
    board_id: 'board-pres-1',
    event_id: 'event-pres-1',
    task_id: 'task-catering-2',
    category_id: 'cat-catering',
    direction: 'outflow',
    amount: 2500000.0,
    currency: 'IDR',
    description: 'Lunch box vendor',
    occurred_on: '2026-08-12',
    created_at: '2026-08-12T00:00:00Z',
  },
  {
    id: 'entry-other-board',
    board_id: 'board-other-2',
    event_id: null,
    task_id: null,
    category_id: 'cat-venue',
    direction: 'outflow',
    amount: 1000000.0,
    currency: 'IDR',
    description: 'Other board expense',
    occurred_on: '2026-08-15',
    created_at: '2026-08-15T00:00:00Z',
  },
];

const mockCategories = [
  { id: 'cat-sponsorship', name: 'Sponsorship', slug: 'sponsorship', direction: 'inflow', color: '#10B981', archived: false },
  { id: 'cat-ticketing', name: 'Ticketing', slug: 'ticketing', direction: 'inflow', color: '#065F46', archived: false },
  { id: 'cat-venue', name: 'Venue', slug: 'venue', direction: 'outflow', color: '#EF4444', archived: false },
  { id: 'cat-catering', name: 'Catering', slug: 'catering', direction: 'outflow', color: '#F59E0B', archived: false },
];

const fakeSupabase = () => ({
  from: (table: string) => ({
    select: () => ({
      eq: (col: string, val: unknown) => {
        if (table === 'finance_entries') {
          const matching = mockEntries.filter(
            (e) => (e as unknown as Record<string, unknown>)[col] === val
          );
          return Promise.resolve({ data: matching, error: null });
        }
        if (table === 'finance_categories') {
          const matching = mockCategories.filter(
            (c) => (c as unknown as Record<string, unknown>)[col] === val
          );
          return Promise.resolve({ data: matching, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
      in: (col: string, vals: string[]) => {
        if (table === 'finance_categories') {
          const matching = mockCategories.filter((c) =>
            vals.includes((c as unknown as Record<string, unknown>)[col] as string)
          );
          return Promise.resolve({ data: matching, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
      order: () => {
        if (table === 'finance_categories') {
          return Promise.resolve({ data: mockCategories, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
    }),
  }),
});

mock.module('@/lib/supabase/server', () => ({
  createClient: () => fakeSupabase(),
}));

const { getBoardFinanceSummaryAction, getEventFinanceSummaryAction } = await import('./actions');

describe('PSI-104: Finance on event boards and events', () => {
  beforeEach(() => {
    mockSessionUser = {
      userId: 'user-treasurer-1',
      email: 'treasurer@p3md.local',
      permissions: ['finance.read', 'finance.write', 'kanban.write'],
    };
  });

  describe('getBoardFinanceSummaryAction', () => {
    test('computes inflow, outflow, net and per-category breakdown for a board', async () => {
      const res = await getBoardFinanceSummaryAction('board-pres-1');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // Inflow: 10M + 5M = 15,000,000
      expect(res.data.inflow).toBe('15000000.00');
      // Outflow: 4M + 2.5M = 6,500,000
      expect(res.data.outflow).toBe('6500000.00');
      // Net: 15M - 6.5M = 8,500,000
      expect(res.data.net).toBe('8500000.00');
      expect(res.data.entryCount).toBe(4);

      // Category breakdown
      expect(res.data.categories.length).toBe(4);
      const venue = res.data.categories.find((c) => c.slug === 'venue');
      expect(venue).toBeDefined();
      expect(venue?.total).toBe('4000000.00');
      expect(venue?.count).toBe(1);
    });

    test('returns zero totals for a board with no entries', async () => {
      const res = await getBoardFinanceSummaryAction('board-empty-999');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.inflow).toBe('0.00');
      expect(res.data.outflow).toBe('0.00');
      expect(res.data.net).toBe('0.00');
      expect(res.data.entryCount).toBe(0);
      expect(res.data.categories.length).toBe(0);
    });

    test('fails if user lacks finance.read permission', async () => {
      mockSessionUser = {
        userId: 'user-plain-member',
        email: 'member@p3md.local',
        permissions: ['kanban.read'], // No finance.read
      };

      const res = await getBoardFinanceSummaryAction('board-pres-1');
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Forbidden|finance\.read/i);
    });
  });

  describe('getEventFinanceSummaryAction', () => {
    test('computes inflow, outflow and net for an event', async () => {
      const res = await getEventFinanceSummaryAction('event-pres-1');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.inflow).toBe('15000000.00');
      expect(res.data.outflow).toBe('6500000.00');
      expect(res.data.net).toBe('8500000.00');
      expect(res.data.entryCount).toBe(4);
    });

    test('returns zeroes for an event with no finance entries', async () => {
      const res = await getEventFinanceSummaryAction('event-no-finance-999');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.inflow).toBe('0.00');
      expect(res.data.outflow).toBe('0.00');
      expect(res.data.net).toBe('0.00');
      expect(res.data.entryCount).toBe(0);
    });

    test('fails if user lacks finance.read permission', async () => {
      mockSessionUser = {
        userId: 'user-plain-member',
        email: 'member@p3md.local',
        permissions: ['calendar.read'], // No finance.read
      };

      const res = await getEventFinanceSummaryAction('event-pres-1');
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Forbidden|finance\.read/i);
    });
  });
});