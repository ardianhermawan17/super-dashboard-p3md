import { z } from 'zod';
import { defineTool } from '../define';
import { boardLink, deepLink } from '../links';

/** Direction matches the check constraint on finance_entries.direction. */
const DIRECTIONS = ['inflow', 'outflow'] as const;
type Direction = (typeof DIRECTIONS)[number];

export type FinanceTotals = {
  inflow: string;
  outflow: string;
  net: string;
};

export type FinanceCategoryBreakdown = {
  category: string;
  direction: Direction;
  total: string;
  count: number;
};

export type FinanceRecentEntry = {
  occurredOn: string;
  direction: Direction;
  amount: string;
  currency: 'IDR';
  category: string;
  description: string;
  board: string;
  event?: string;
  link: string;
};

export type FinanceToolResult = {
  currency: 'IDR';
  totals: FinanceTotals;
  byCategory: FinanceCategoryBreakdown[];
  recent: FinanceRecentEntry[];
};

/** Format a number to a decimal string "1234567.89" with exactly 2 places (no float artifacts). */
function formatAmount(value: number): string {
  const [int, dec] = value.toFixed(2).split('.');
  return `${Number(int).toString()}.${dec}`;
}

/**
 * PSI-105: Finance tool for the assistant and MCP clients.
 *
 * Spec: docs/frontend-architecture/features/finance.md §Agent tool
 *
 * Reads `agent_finance` (security invoker view) for totals and `finance_entries`
 * for recent rows. RLS decides what the caller sees: a caller without `finance.read`
 * or without membership in the board gets empty data. Read-only, no creator
 * identities, max 50 recent rows, deep links on every row.
 */
export const getFinance = defineTool({
  name: 'get_finance',
  title: 'Finance summary and entries',
  description:
    'Ledger summary and recent income/spending. Returns IDR totals (inflow, outflow, net), ' +
    'per-category breakdown, and recent entries with deep links. Scoped to what the caller ' +
    'has permission to read. Date ranges filter recent entries exactly and keep aggregate ' +
    'groups whose span overlaps the range. Capped at 50 entries.',
  input: z.object({
    eventId: z.string().uuid().optional().describe('Limit to one event'),
    boardId: z.string().uuid().optional().describe('Limit to one board'),
    from: z.string().date().optional().describe('YYYY-MM-DD, WIB, inclusive'),
    to: z.string().date().optional().describe('YYYY-MM-DD, WIB, inclusive'),
    category: z.string().optional().describe('Category slug, e.g. venue, sponsorship'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('Max recent entries to return (1..50, default 20)'),
  }),
  async run(
    { eventId, boardId, from, to, category, limit },
    { db }
  ): Promise<FinanceToolResult> {
    // 1. Totals + category breakdown from agent_finance (security_invoker view).
    let totalsQuery = db
      .from('agent_finance')
      .select('board_id, board, event_id, event, direction, category, category_name, currency, entry_count, total, first_on, last_on');

    if (boardId) totalsQuery = totalsQuery.eq('board_id', boardId);
    if (eventId) totalsQuery = totalsQuery.eq('event_id', eventId);
    if (category) totalsQuery = totalsQuery.eq('category', category);
    // agent_finance is grouped per (board, event, category, direction) with the
    // group's first/last entry date. A date range keeps a group whose span overlaps
    // the range (its entries may also fall outside it — totals are group-scoped).
    if (from) totalsQuery = totalsQuery.gte('last_on', from);
    if (to) totalsQuery = totalsQuery.lte('first_on', to);

    const { data: aggRows, error: aggError } = await totalsQuery;
    if (aggError) throw new Error(aggError.message);

    const rows = aggRows ?? [];
    let inflowNum = 0;
    let outflowNum = 0;
    const catMap = new Map<string, { direction: Direction; total: number; count: number }>();

    for (const r of rows) {
      const amount = Number(r.total ?? 0);
      const dir = (r.direction ?? 'outflow') as Direction;
      if (dir === 'inflow') inflowNum += amount;
      else outflowNum += amount;

      const slug = r.category ?? 'uncategorised';
      const cur = catMap.get(slug) ?? { direction: dir, total: 0, count: 0 };
      cur.total += amount;
      cur.count += Number(r.entry_count ?? 0);
      cur.direction = dir;
      catMap.set(slug, cur);
    }

    const byCategory: FinanceCategoryBreakdown[] = Array.from(catMap.entries())
      .map(([slug, val]) => ({
        category: slug,
        direction: val.direction,
        total: formatAmount(val.total),
        count: val.count,
      }))
      .toSorted((a, b) =>
        a.direction === b.direction
          ? b.total.localeCompare(a.total)
          : a.direction === 'outflow'
            ? -1
            : 1
      );

    // 2. Recent entries from finance_entries (with board / category / event context).
    let recentQuery = db
      .from('finance_entries')
      .select(
        'id, board_id, event_id, direction, amount, currency, description, occurred_on, created_at, ' +
          'boards(name), finance_categories(slug, name), events(title)'
      )
      .order('occurred_on', { ascending: false })
      .limit(limit);

    if (boardId) recentQuery = recentQuery.eq('board_id', boardId);
    if (eventId) recentQuery = recentQuery.eq('event_id', eventId);
    if (from) recentQuery = recentQuery.gte('occurred_on', from);
    if (to) recentQuery = recentQuery.lte('occurred_on', to);

    const { data: entryRows, error: entryError } = await recentQuery;
    if (entryError) throw new Error(entryError.message);

    type RecentEntryRow = {
      board_id: string;
      event_id: string | null;
      occurred_on: string;
      direction: string;
      amount: string | number;
      description: string | null;
      boards?: { name: string } | null;
      finance_categories?: { slug: string } | null;
      events?: { title: string } | null;
    };

    const recent: FinanceRecentEntry[] = ((entryRows as unknown as RecentEntryRow[] | null) ?? [])
      .map((e) => {
        const catSlug = e.finance_categories?.slug ?? 'uncategorised';
            const boardName = e.boards?.name ?? 'Unknown board';
            const eventTitle = e.events?.title ?? undefined;
        // Deep link: prefer event detail link if linked to an event, else board link.
        const link = e.event_id ? deepLink('event', e.event_id) : boardLink(e.board_id);

        const row: FinanceRecentEntry = {
          occurredOn: e.occurred_on,
          direction: e.direction as Direction,
          amount: typeof e.amount === 'string' ? e.amount : formatAmount(Number(e.amount)),
          currency: 'IDR',
          category: catSlug,
          description: e.description ?? '',
          board: boardName,
          link,
        };
        if (eventTitle) row.event = eventTitle;
        return row;
      })
      .filter((r) => !category || r.category === category);

    return {
      currency: 'IDR',
      totals: {
        inflow: formatAmount(inflowNum),
        outflow: formatAmount(outflowNum),
        net: formatAmount(inflowNum - outflowNum),
      },
      byCategory,
      recent,
    };
  },
});