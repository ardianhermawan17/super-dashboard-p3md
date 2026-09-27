// frontend-architecture/src/features/calendar/event-board.test.ts
// Unit tests for PSI-102: "Create event board from calendar"
// Spec: docs/frontend-architecture/features/finance.md line 8 & calendar.md & PSI-102 card accept criteria

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// Stub server-only for bun test environment
mock.module('server-only', () => ({}));

type InsertedBoard = {
  id: string;
  name: string;
  event_id: string | null;
  created_by: string;
};

type InsertedColumn = {
  board_id: string;
  title: string;
  position: string;
  is_done: boolean;
};

type InsertedBoardGroup = {
  board_id: string;
  group_id: string;
};

let insertedBoards: InsertedBoard[] = [];
let insertedColumns: InsertedColumn[] = [];
let insertedBoardGroups: InsertedBoardGroup[] = [];

// Mock session user
let mockSessionUser: {
  userId: string;
  email: string;
  permissions: string[];
} | null = {
  userId: 'user-creator-123',
  email: 'creator@p3md.local',
  permissions: ['kanban.write', 'calendar.read']
};

mock.module('@/lib/auth/session', () => ({
  getSession: () => Promise.resolve(mockSessionUser)
}));

mock.module('@/lib/auth/require', () => ({
  requirePermission: (key: string) => {
    if (!mockSessionUser) throw new Error('Unauthorized');
    if (!mockSessionUser.permissions.includes(key)) throw new Error(`Forbidden: missing ${key}`);
    return Promise.resolve(mockSessionUser);
  }
}));

// Mock event in DB
const mockEvents = new Map<
  string,
  {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    created_by: string;
  }
>([
  [
    'event-pres-001',
    {
      id: 'event-pres-001',
      title: 'Event President · 17-08-2026',
      starts_at: '2026-08-17T08:00:00Z',
      ends_at: '2026-08-17T17:00:00Z',
      created_by: 'user-admin'
    }
  ]
]);

// Mock event audience (users, roles, and groups)
const mockAudience = [
  { event_id: 'event-pres-001', user_id: 'user-aud-1', role_id: null, group_id: null },
  { event_id: 'event-pres-001', user_id: null, role_id: 'role-aud-1', group_id: null },
  { event_id: 'event-pres-001', user_id: null, role_id: null, group_id: 'group-panitia-1' },
  { event_id: 'event-pres-001', user_id: null, role_id: null, group_id: 'group-logistik-2' }
];

const fakeSupabase = () => ({
  from: (table: string) => ({
    select: () => ({
      eq: (col: string, val: unknown) => {
        if (table === 'event_audience' && col === 'event_id') {
          const matching = mockAudience.filter((a) => a.event_id === val);
          return Promise.resolve({ data: matching, error: null });
        }
        return {
          single: () => {
            if (table === 'events' && col === 'id') {
              const ev = mockEvents.get(String(val));
              return Promise.resolve({
                data: ev ?? null,
                error: ev ? null : { message: 'not found' }
              });
            }
            if (table === 'boards' && col === 'event_id') {
              const b = insertedBoards.find((b) => b.event_id === val);
              return Promise.resolve({ data: b ?? null, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
          maybeSingle: () => {
            if (table === 'boards' && col === 'event_id') {
              const b = insertedBoards.find((b) => b.event_id === val);
              return Promise.resolve({ data: b ?? null, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }
        };
      },
      in: (_col: string, vals: string[]) => {
        if (table === 'boards') {
          const matching = insertedBoards.filter((b) => b.event_id && vals.includes(b.event_id));
          return Promise.resolve({ data: matching, error: null });
        }
        if (table === 'event_audience') {
          const matching = mockAudience.filter((a) => vals.includes(a.event_id));
          return Promise.resolve({ data: matching, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      }
    }),
    insert: (payload: { name?: string; event_id?: string | null; created_by?: string }) => {
      if (table === 'boards') {
        const newBoard: InsertedBoard = {
          id: `board-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: payload.name ?? '',
          event_id: payload.event_id ?? null,
          created_by: payload.created_by ?? ''
        };
        insertedBoards.push(newBoard);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: newBoard, error: null })
          })
        };
      }
      if (table === 'board_columns') {
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const r of rows) insertedColumns.push(r);
        return Promise.resolve({ error: null });
      }
      if (table === 'board_groups') {
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const r of rows) insertedBoardGroups.push(r);
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ error: null });
    }
  })
});

mock.module('@/lib/supabase/server', () => ({
  createClient: () => fakeSupabase()
}));

// Import action under test
const { createEventBoardAction } = await import('./actions');

describe('PSI-102: createEventBoardAction', () => {
  beforeEach(() => {
    insertedBoards = [];
    insertedColumns = [];
    insertedBoardGroups = [];
    mockSessionUser = {
      userId: 'user-creator-123',
      email: 'creator@p3md.local',
      permissions: ['kanban.write', 'calendar.read']
    };
  });

  test('creates a board named after the event with event_id set and default columns', async () => {
    const res = await createEventBoardAction('event-pres-001');

    expect(res.ok).toBe(true);
    expect(res.boardId).toBeDefined();

    // 1. Board verification
    const board = insertedBoards.find((b) => b.id === res.boardId);
    expect(board).toBeDefined();
    expect(board?.name).toBe('Event President · 17-08-2026');
    expect(board?.event_id).toBe('event-pres-001');
    expect(board?.created_by).toBe('user-creator-123');

    // 2. Default columns verification (Backlog, In Progress, Done)
    const columns = insertedColumns.filter((c) => c.board_id === res.boardId);
    expect(columns.length).toBe(3);
    expect(columns.map((c) => c.title)).toEqual(['Backlog', 'In Progress', 'Done']);
    expect(columns.find((c) => c.title === 'Done')?.is_done).toBe(true);
  });

  test('copies only group audience into board_groups (never users or roles)', async () => {
    const res = await createEventBoardAction('event-pres-001');
    expect(res.ok).toBe(true);

    const bg = insertedBoardGroups.filter((g) => g.board_id === res.boardId);
    expect(bg.length).toBe(2);
    expect(bg.map((g) => g.group_id).toSorted()).toEqual(
      ['group-logistik-2', 'group-panitia-1'].toSorted()
    );
  });

  test('is idempotent: second click returns existing board without creating duplicate', async () => {
    const first = await createEventBoardAction('event-pres-001');
    expect(first.ok).toBe(true);
    const countAfterFirst = insertedBoards.length;
    expect(countAfterFirst).toBe(1);

    const second = await createEventBoardAction('event-pres-001');
    expect(second.ok).toBe(true);
    expect(second.boardId).toBe(first.boardId);
    expect(insertedBoards.length).toBe(1); // No new board created
  });

  test('fails if user lacks kanban.write permission', async () => {
    mockSessionUser = {
      userId: 'user-viewer',
      email: 'viewer@p3md.local',
      permissions: ['calendar.read'] // No kanban.write
    };

    const res = await createEventBoardAction('event-pres-001');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Forbidden|kanban\.write|Unauthorized/i);
    expect(insertedBoards.length).toBe(0);
  });

  test('fails gracefully when event does not exist', async () => {
    const res = await createEventBoardAction('nonexistent-event-999');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
    expect(insertedBoards.length).toBe(0);
  });
});
