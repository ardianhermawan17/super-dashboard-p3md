// frontend-architecture/src/features/finance/categories.test.ts
// PSI-123 AC: "the finance entry dialog's Category combobox lists the non-archived categories".
// The dialog renders `listCategoriesAction()` output, so this asserts the query the action
// actually issues (archived = false) and that archived rows never reach the combobox.

import { beforeEach, describe, expect, mock, test } from 'bun:test';

mock.module('server-only', () => ({}));

let mockSessionUser: { userId: string; email: string; permissions: string[] } | null = {
  userId: 'user-pm-1',
  email: 'pm@p3md.local',
  permissions: ['finance.read'],
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

type Row = Record<string, unknown>;

const categories: Row[] = [
  { id: 'c-venue', slug: 'venue', name: 'Venue', direction: 'outflow', color: '#EF4444', archived: false },
  { id: 'c-catering', slug: 'catering', name: 'Catering', direction: 'outflow', color: '#F59E0B', archived: false },
  { id: 'c-legacy', slug: 'legacy', name: 'Legacy grant', direction: 'inflow', color: '#10B981', archived: true },
];

/** Records every query the action builds, and narrows like the database would. */
let seen: { table?: string; filters: [string, unknown][]; orders: string[] } = {
  filters: [],
  orders: [],
};

const fakeSupabase = () => ({
  from: (table: string) => {
    seen.table = table;
    const rows = table === 'finance_categories' ? categories : [];

    const build = (data: Row[]): Row => ({
      eq: (col: string, val: unknown) => {
        seen.filters.push([col, val]);
        return build(data.filter((r) => r[col] === val));
      },
      order: (col: string) => {
        seen.orders.push(col);
        const sorted = [...data].sort((a, b) => String(a[col]).localeCompare(String(b[col])));
        return Promise.resolve({ data: sorted, error: null });
      },
    });

    return { select: () => build(rows) };
  },
});

mock.module('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(fakeSupabase()),
}));

beforeEach(() => {
  seen = { filters: [], orders: [] };
  mockSessionUser = { userId: 'user-pm-1', email: 'pm@p3md.local', permissions: ['finance.read'] };
});

const { listCategoriesAction } = await import('./actions');

describe('listCategoriesAction (PSI-123 · Category combobox lists non-archived categories)', () => {
  test('queries finance_categories filtered on archived = false, ordered by name', async () => {
    const res = await listCategoriesAction();

    expect(seen.table).toBe('finance_categories');
    expect(seen.filters).toContainEqual(['archived', false]);
    expect(seen.orders).toContain('name');
    expect(res.ok).toBe(true);
  });

  test('returns only the non-archived categories, named in order', async () => {
    const res = await listCategoriesAction();
    if (!res.ok) throw new Error(res.error);

    expect(res.data.map((c) => c.name)).toEqual(['Catering', 'Venue']);
    expect(res.data.map((c) => c.name)).not.toContain('Legacy grant');
    expect(res.data.every((c) => c.archived === false)).toBe(true);
  });

  test('an archived category is reachable only through its own id, never the list', async () => {
    const res = await listCategoriesAction();
    if (!res.ok) throw new Error(res.error);

    const ids = res.data.map((c) => c.id);
    expect(ids).not.toContain('c-legacy');
    expect(ids).toContain('c-venue');
  });

  test('signed out: refuses instead of returning rows', async () => {
    mockSessionUser = null;
    const res = await listCategoriesAction();

    expect(res.ok).toBe(false);
    expect(seen.table).toBeUndefined();
  });
});
