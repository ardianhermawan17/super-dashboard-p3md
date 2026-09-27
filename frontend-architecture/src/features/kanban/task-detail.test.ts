// frontend-architecture/src/features/kanban/task-detail.test.ts
// Unit tests for PSI-109: Kanban task detail panel (click to open, linked calendar + finance)

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Stub server-only
mock.module('server-only', () => ({}));

let mockSessionUser: {
  userId: string;
  email: string;
  permissions: string[];
} | null = {
  userId: 'user-admin-1',
  email: 'admin@p3md.local',
  permissions: ['kanban.read', 'kanban.write', 'finance.read', 'finance.write'],
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

let mockTaskUpdates: Record<string, unknown> = {};

function chain(result: { data: unknown; error: null }) {
  return {
    // oxlint-disable-next-line unicorn/no-thenable -- mock needs to be awaitable and chainable (.order)
    then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    order: (_col: string, _opts?: unknown) => Promise.resolve(result),
    limit: (_n: number) => Promise.resolve(result),
  };
}

const financeEntry = {
  id: 'entry-1',
  board_id: 'board-1',
  task_id: 'task-1',
  event_id: 'event-1',
  category_id: 'cat-1',
  direction: 'outflow',
  amount: '1500000.00',
  currency: 'IDR',
  description: 'Stage props',
  occurred_on: '2026-08-10',
  created_at: '2026-08-10T00:00:00Z',
};

const fakeSupabase = () => ({
  from: (table: string) => ({
    update: (data: Record<string, unknown>) => {
      mockTaskUpdates = data;
      return {
        eq: (_col: string, _val: unknown) => Promise.resolve({ error: null }),
      };
    },
    select: (_cols?: string) => ({
      eq: (col: string, val: unknown) => {
        if (table === 'finance_entries' && col === 'task_id') {
          return chain(
            val === 'task-1'
              ? { data: [financeEntry], error: null }
              : { data: [], error: null }
          );
        }
        return chain({ data: [], error: null });
      },
      in: (_col: string, vals: unknown[]) => {
        if (table === 'finance_categories') {
          return Promise.resolve({
            data: [{ id: 'cat-1', name: 'Stage', slug: 'stage' }],
            error: null,
          });
        }
        if (table === 'boards' && vals.includes('board-1')) {
          return Promise.resolve({ data: [{ id: 'board-1', name: 'Board 1' }], error: null });
        }
        return Promise.resolve({ data: [], error: null });
      },
    }),
  }),
});

mock.module('@/lib/supabase/server', () => ({
  createClient: () => fakeSupabase(),
}));

const { updateTaskAction } = await import('./actions');
const { getTaskFinanceEntriesAction } = await import('@/features/finance/actions');

describe('PSI-109: Kanban task detail panel', () => {
  beforeEach(() => {
    mockTaskUpdates = {};
    mockSessionUser = {
      userId: 'user-admin-1',
      email: 'admin@p3md.local',
      permissions: ['kanban.read', 'kanban.write', 'finance.read', 'finance.write'],
    };
  });

  describe('updateTaskAction', () => {
    test('updates task fields including column_id', async () => {
      const res = await updateTaskAction('task-1', {
        title: 'Updated title',
        description: 'New description',
        priority: 'high',
        column_id: 'col-done',
        due_date: '2026-09-30',
      });

      expect(res.ok).toBe(true);
      expect(mockTaskUpdates.title).toBe('Updated title');
      expect(mockTaskUpdates.description).toBe('New description');
      expect(mockTaskUpdates.priority).toBe('high');
      expect(mockTaskUpdates.column_id).toBe('col-done');
      expect(mockTaskUpdates.due_date).toBe('2026-09-30');
    });
  });

  describe('getTaskFinanceEntriesAction', () => {
    test('returns finance entries linked to a specific task', async () => {
      const res = await getTaskFinanceEntriesAction('task-1');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe('entry-1');
      expect(res.data[0].amount).toBe('1500000.00');
      expect(res.data[0].category_name).toBe('Stage');
    });

    test('returns empty list for a task with no finance entries', async () => {
      const res = await getTaskFinanceEntriesAction('task-empty-999');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.data.length).toBe(0);
    });

    test('fails if user lacks finance.read permission', async () => {
      mockSessionUser = {
        userId: 'user-member',
        email: 'member@p3md.local',
        permissions: ['kanban.read', 'kanban.write'], // no finance.read
      };

      const res = await getTaskFinanceEntriesAction('task-1');
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Forbidden|finance\.read/i);
    });
  });
});