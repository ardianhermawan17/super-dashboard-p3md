/**
 * PSI-106: pure aggregation for the overview finance charts.
 *
 * Kept free of server-only imports so the arithmetic is unit-testable and the
 * action stays a thin RLS-scoped fetch + this. All amounts are decimal strings
 * (never floats on the wire), matching m10-finance.md.
 */

export type FinanceRow = {
  direction: 'inflow' | 'outflow';
  /** Decimal string, e.g. "1000000.00". */
  amount: string;
  /** YYYY-MM-DD (WIB). */
  occurred_on: string;
  category_slug: string;
  category_name: string;
};

export type MonthlyFinance = {
  /** YYYY-MM, oldest first. */
  month: string;
  inflow: string;
  outflow: string;
};

export type CategoryOutflow = {
  slug: string;
  name: string;
  total: string;
};

export type FinanceOverview = {
  monthly: MonthlyFinance[];
  outflowByCategory: CategoryOutflow[];
};

/** Format a number to a decimal string "1234567.89" (2 decimals, no float artifacts). */
function formatAmount(value: number): string {
  const [int, dec] = value.toFixed(2).split('.');
  return `${Number(int).toString()}.${dec}`;
}

/** YYYY-MM of a date, in the local (server) timezone. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Last `count` month keys, oldest first, ending at (and including) the current month. */
function lastMonths(now: Date, count: number): string[] {
  const keys: string[] = [];
  const cursor = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

export function aggregateFinanceOverview(
  rows: FinanceRow[],
  opts: { now?: Date; topCategories?: number } = {}
): FinanceOverview {
  const now = opts.now ?? new Date();
  const topN = opts.topCategories ?? 5;

  // 1. Monthly inflow/outflow (last 6 months, zero-filled).
  const months = lastMonths(now, 6);
  const monthly = new Map<string, { inflow: number; outflow: number }>();
  for (const m of months) {
    monthly.set(m, { inflow: 0, outflow: 0 });
  }
  for (const r of rows) {
    const key = r.occurred_on.slice(0, 7); // YYYY-MM from a YYYY-MM-DD string
    const bucket = monthly.get(key);
    if (!bucket) continue; // outside the window
    if (r.direction === 'inflow') {
      bucket.inflow += Number(r.amount);
    } else {
      bucket.outflow += Number(r.amount);
    }
  }

  // 2. Outflow by category, top N + Other (sum preserved).
  const catTotals = new Map<string, { name: string; total: number }>();
  for (const r of rows) {
    if (r.direction !== 'outflow') continue;
    const cur = catTotals.get(r.category_slug) ?? { name: r.category_name, total: 0 };
    cur.total += Number(r.amount);
    catTotals.set(r.category_slug, cur);
  }

  const sorted = Array.from(catTotals.entries())
    .map(([slug, val]) => ({ slug, name: val.name, total: val.total }))
    .toSorted((a, b) => b.total - a.total);

  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const outflowByCategory: CategoryOutflow[] = top.map((c) => ({
    slug: c.slug,
    name: c.name,
    total: formatAmount(c.total),
  }));
  if (rest.length > 0) {
    outflowByCategory.push({
      slug: 'other',
      name: 'Other',
      total: formatAmount(rest.reduce((acc, c) => acc + c.total, 0)),
    });
  }

  return {
    monthly: months.map((m) => {
      const bucket = monthly.get(m)!;
      return {
        month: m,
        inflow: formatAmount(bucket.inflow),
        outflow: formatAmount(bucket.outflow),
      };
    }),
    outflowByCategory,
  };
}