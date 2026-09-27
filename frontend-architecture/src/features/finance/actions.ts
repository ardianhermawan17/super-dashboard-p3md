'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/require';
import {
  aggregateFinanceOverview,
  type FinanceOverview,
  type FinanceRow
} from './overview-lib';
import {
  categorySchema,
  entrySchema,
  type BoardOption,
  type CategoryInput,
  type Direction,
  type EntryFilters,
  type EntryInput,
  type FinanceCategory,
  type FinanceEntry
} from './types';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Converts a `requirePermission` redirect/notFound throw (page-only) into a plain error for Server Actions. */
async function checkPermission(key: string) {
  try {
    return { session: await requirePermission(key), error: null as string | null };
  } catch {
    return { session: null, error: `Forbidden: missing ${key}` };
  }
}

export async function listEntriesAction(
  filters: EntryFilters
): Promise<ActionResult<{ items: FinanceEntry[]; total: number }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const from = (filters.page - 1) * filters.perPage;
  const to = from + filters.perPage - 1;

  let query = supabase
    .from('finance_entries')
    .select(
      'id, board_id, task_id, event_id, category_id, direction, amount, currency, description, occurred_on, created_at',
      {
        count: 'exact'
      }
    )
    .order('occurred_on', { ascending: false })
    .range(from, to);

  if (filters.direction.length > 0) query = query.in('direction', filters.direction);
  if (filters.category.length > 0) query = query.in('category_id', filters.category);
  if (filters.occurredOn) {
    const [fromMs, toMs] = filters.occurredOn;
    query = query
      .gte('occurred_on', new Date(Number(fromMs)).toISOString().slice(0, 10))
      .lte('occurred_on', new Date(Number(toMs)).toISOString().slice(0, 10));
  }
  if (filters.amount) {
    const [min, max] = filters.amount;
    query = query.gte('amount', min).lte('amount', max);
  }

  const { data: rows, error, count } = await query;
  if (error) return { ok: false, error: error.message };

  // Two lookups instead of an embedded select: board_id has two possible
  // relationships (boards and the agent_board_status view), which breaks
  // PostgREST's embedded-select type inference for a joined query string.
  const boardIds = Array.from(new Set((rows ?? []).map((r) => r.board_id)));
  const categoryIds = Array.from(new Set((rows ?? []).map((r) => r.category_id)));
  const [{ data: boards }, { data: categories }] = await Promise.all([
    boardIds.length
      ? supabase.from('boards').select('id, name').in('id', boardIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    categoryIds.length
      ? supabase.from('finance_categories').select('id, slug, name').in('id', categoryIds)
      : Promise.resolve({ data: [] as { id: string; slug: string; name: string }[] })
  ]);
  const boardById = new Map((boards ?? []).map((b) => [b.id, b.name]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const items: FinanceEntry[] = (rows ?? []).map((row) => ({
    id: row.id,
    board_id: row.board_id,
    board_name: boardById.get(row.board_id) ?? '',
    task_id: row.task_id,
    event_id: row.event_id,
    category_id: row.category_id,
    category_slug: categoryById.get(row.category_id)?.slug ?? '',
    category_name: categoryById.get(row.category_id)?.name ?? '',
    direction: row.direction as FinanceEntry['direction'],
    amount: String(row.amount),
    currency: 'IDR',
    description: row.description,
    occurred_on: row.occurred_on,
    created_at: row.created_at
  }));

  return { ok: true, data: { items, total: count ?? items.length } };
}

export async function listCategoriesAction(): Promise<ActionResult<FinanceCategory[]>> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('finance_categories')
    .select('id, slug, name, direction, color, archived')
    .eq('archived', false)
    .order('name');

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as FinanceCategory[] };
}

export async function listBoardsAction(): Promise<ActionResult<BoardOption[]>> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const { data, error } = await supabase.from('boards').select('id, name').order('name');
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function createEntryAction(input: EntryInput): Promise<ActionResult<{ id: string }>> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid entry' };

  const { session, error } = await checkPermission('finance.write');
  if (!session) return { ok: false, error: error ?? 'Forbidden' };

  const supabase = await createClient();
  const { data, error: insertError } = await supabase
    .from('finance_entries')
    .insert({
      board_id: parsed.data.boardId,
      task_id: parsed.data.taskId ?? null,
      category_id: parsed.data.categoryId,
      direction: parsed.data.direction,
      amount: Number(parsed.data.amount),
      description: parsed.data.description,
      occurred_on: parsed.data.occurredOn,
      created_by: session.userId
    })
    .select('id')
    .single();

  if (insertError || !data)
    return { ok: false, error: insertError?.message ?? 'Failed to create entry' };
  return { ok: true, data: { id: data.id } };
}

export async function updateEntryAction(
  id: string,
  input: EntryInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid entry' };

  const { error } = await checkPermission('finance.write');
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from('finance_entries')
    .update({
      board_id: parsed.data.boardId,
      task_id: parsed.data.taskId ?? null,
      category_id: parsed.data.categoryId,
      direction: parsed.data.direction,
      amount: Number(parsed.data.amount),
      description: parsed.data.description,
      occurred_on: parsed.data.occurredOn
    })
    .eq('id', id);

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true, data: { id } };
}

export async function deleteEntryAction(id: string): Promise<ActionResult<{ id: string }>> {
  const { error } = await checkPermission('finance.write');
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const { error: deleteError } = await supabase.from('finance_entries').delete().eq('id', id);
  if (deleteError) return { ok: false, error: deleteError.message };
  return { ok: true, data: { id } };
}

export async function upsertCategoryAction(
  input: CategoryInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid category' };

  const { error } = await checkPermission('finance.manage');
  if (error) return { ok: false, error };

  const supabase = await createClient();
  const { data, error: upsertError } = await supabase
    .from('finance_categories')
    .upsert({
      id: parsed.data.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      direction: parsed.data.direction ?? null,
      color: parsed.data.color ?? null
    })
    .select('id')
    .single();

  if (upsertError || !data)
    return { ok: false, error: upsertError?.message ?? 'Failed to save category' };
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// PSI-104: Finance summaries (board tab and event detail)
// ---------------------------------------------------------------------------

export type FinanceSummaryCategory = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  direction: Direction;
  total: string;
  count: number;
};

export type FinanceSummary = {
  inflow: string;
  outflow: string;
  net: string;
  entryCount: number;
  categories: FinanceSummaryCategory[];
};

/** Round a numeric total into a decimal string "1234567.89" (2 decimals, no float artifacts). */
function formatAmount(value: number): string {
  const [int, dec] = value.toFixed(2).split('.');
  return `${Number(int).toString()}.${dec}`;
}

/**
 * Board scope: inflow, outflow, net and a per-category breakdown for the entries
 * the caller may read on this board (RLS applies to every fetch).
 */
export async function getBoardFinanceSummaryAction(
  boardId: string
): Promise<ActionResult<FinanceSummary>> {
  const { session, error } = await checkPermission('finance.read');
  if (!session) return { ok: false, error: error ?? 'Forbidden' };
  const supabase = await createClient();

  const { data: rows, error: fetchError } = await supabase
    .from('finance_entries')
    .select('category_id, direction, amount')
    .eq('board_id', boardId);

  if (fetchError) return { ok: false, error: fetchError.message };
  const entries = rows ?? [];

  let inflow = 0;
  let outflow = 0;
  const catTotals = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const amount = Number(e.amount);
    if (e.direction === 'inflow') inflow += amount;
    else outflow += amount;
    const cur = catTotals.get(e.category_id) ?? { total: 0, count: 0 };
    cur.total += amount;
    cur.count += 1;
    catTotals.set(e.category_id, cur);
  }

  const categoryIds = Array.from(catTotals.keys());
  let categoryInfo: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    direction: string | null;
  }[] = [];
  if (categoryIds.length > 0) {
    const { data: cats } = await supabase
      .from('finance_categories')
      .select('id, name, slug, color, direction')
      .in('id', categoryIds);
    categoryInfo = cats ?? [];
  }
  const catById = new Map(categoryInfo.map((c) => [c.id, c]));

  const categories: FinanceSummaryCategory[] = Array.from(catTotals.entries())
    .map(([id, t]) => {
      const info = catById.get(id);
      return {
        id,
        name: info?.name ?? id,
        slug: info?.slug ?? id,
        color: info?.color ?? null,
        direction: (info?.direction ?? 'outflow') as Direction,
        total: formatAmount(t.total),
        count: t.count
      };
    })
    .toSorted((a, b) =>
      a.direction === b.direction
        ? b.total.localeCompare(a.total)
        : a.direction === 'outflow'
          ? -1
          : 1
    );

  return {
    ok: true,
    data: {
      inflow: formatAmount(inflow),
      outflow: formatAmount(outflow),
      net: formatAmount(inflow - outflow),
      entryCount: entries.length,
      categories
    }
  };
}

/**
 * Event scope: net of the finance entries linked to this event (event_id),
 * for users who can read finance.
 */
export async function getEventFinanceSummaryAction(
  eventId: string
): Promise<ActionResult<FinanceSummary>> {
  const { session, error } = await checkPermission('finance.read');
  if (!session) return { ok: false, error: error ?? 'Forbidden' };
  const supabase = await createClient();

  const { data: rows, error: fetchError } = await supabase
    .from('finance_entries')
    .select('category_id, direction, amount')
    .eq('event_id', eventId);

  if (fetchError) return { ok: false, error: fetchError.message };
  const entries = rows ?? [];

  let inflow = 0;
  let outflow = 0;
  const catTotals = new Map<string, { total: number; count: number }>();
  for (const e of entries) {
    const amount = Number(e.amount);
    if (e.direction === 'inflow') inflow += amount;
    else outflow += amount;
    const cur = catTotals.get(e.category_id) ?? { total: 0, count: 0 };
    cur.total += amount;
    cur.count += 1;
    catTotals.set(e.category_id, cur);
  }

  const categoryIds = Array.from(catTotals.keys());
  let categoryInfo: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    direction: string | null;
  }[] = [];
  if (categoryIds.length > 0) {
    const { data: cats } = await supabase
      .from('finance_categories')
      .select('id, name, slug, color, direction')
      .in('id', categoryIds);
    categoryInfo = cats ?? [];
  }
  const catById = new Map(categoryInfo.map((c) => [c.id, c]));

  const categories: FinanceSummaryCategory[] = Array.from(catTotals.entries())
    .map(([id, t]) => {
      const info = catById.get(id);
      return {
        id,
        name: info?.name ?? id,
        slug: info?.slug ?? id,
        color: info?.color ?? null,
        direction: (info?.direction ?? 'outflow') as Direction,
        total: formatAmount(t.total),
        count: t.count
      };
    })
    .toSorted((a, b) =>
      a.direction === b.direction
        ? b.total.localeCompare(a.total)
        : a.direction === 'outflow'
          ? -1
          : 1
    );

  return {
    ok: true,
    data: {
      inflow: formatAmount(inflow),
      outflow: formatAmount(outflow),
      net: formatAmount(inflow - outflow),
      entryCount: entries.length,
      categories
    }
  };
}


// ---------------------------------------------------------------------------
// PSI-106: overview finance charts
// ---------------------------------------------------------------------------

/**
 * Data for the overview Finance tab: monthly inflow/outflow (last 6 months) and
 * outflow by category (top 5 + Other). RLS-scoped like every other finance read;
 * the aggregation itself is the pure `aggregateFinanceOverview` helper.
 */
export async function getFinanceOverviewAction(): Promise<ActionResult<FinanceOverview>> {
  const { session, error } = await checkPermission('finance.read');
  if (!session) return { ok: false, error: error ?? 'Forbidden' };
  const supabase = await createClient();

  // Window: last 6 months, from the first day of the oldest month.
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    .toISOString()
    .slice(0, 10);

  const { data: rows, error: fetchError } = await supabase
    .from('finance_entries')
    .select('direction, amount, occurred_on, finance_categories(slug, name)')
    .gte('occurred_on', start);

  if (fetchError) return { ok: false, error: fetchError.message };

  const financeRows: FinanceRow[] = (rows ?? []).map((r) => ({
    direction: r.direction as 'inflow' | 'outflow',
    amount: typeof r.amount === 'string' ? r.amount : Number(r.amount).toFixed(2),
    occurred_on: r.occurred_on,
    category_slug:
      (r.finance_categories as { slug?: string } | null)?.slug ?? 'uncategorised',
    category_name:
      (r.finance_categories as { name?: string } | null)?.name ?? 'Uncategorised'
  }));

  return { ok: true, data: aggregateFinanceOverview(financeRows, { now }) };
}


// ---------------------------------------------------------------------------
// PSI-109: task-scoped finance entries (Kanban detail panel)
// ---------------------------------------------------------------------------

/**
 * Finance entries linked to one task (task_id = taskId), newest first.
 * Gated by finance.read — a caller without it gets ok:false / Forbidden, so the
 * Kanban detail panel can omit the section entirely instead of showing an empty list.
 */
export async function getTaskFinanceEntriesAction(
  taskId: string
): Promise<ActionResult<FinanceEntry[]>> {
  const { session, error } = await checkPermission('finance.read');
  if (!session) return { ok: false, error: error ?? 'Forbidden' };
  const supabase = await createClient();

  const { data: rows, error: fetchError } = await supabase
    .from('finance_entries')
    .select(
      'id, board_id, task_id, event_id, category_id, direction, amount, currency, description, occurred_on, created_at'
    )
    .eq('task_id', taskId)
    .order('occurred_on', { ascending: false });

  if (fetchError) return { ok: false, error: fetchError.message };

  // Same two-lookup enrichment as listEntriesAction (board + category names).
  const boardIds = Array.from(new Set((rows ?? []).map((r) => r.board_id)));
  const categoryIds = Array.from(new Set((rows ?? []).map((r) => r.category_id)));
  const [{ data: boards }, { data: categories }] = await Promise.all([
    boardIds.length
      ? supabase.from('boards').select('id, name').in('id', boardIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    categoryIds.length
      ? supabase.from('finance_categories').select('id, slug, name').in('id', categoryIds)
      : Promise.resolve({ data: [] as { id: string; slug: string; name: string }[] })
  ]);
  const boardById = new Map((boards ?? []).map((b) => [b.id, b.name]));
  const categoryById = new Map((categories ?? []).map((c) => [c.id, c]));

  const items: FinanceEntry[] = (rows ?? []).map((row) => ({
    id: row.id,
    board_id: row.board_id,
    board_name: boardById.get(row.board_id) ?? '',
    task_id: row.task_id,
    event_id: row.event_id,
    category_id: row.category_id,
    category_slug: categoryById.get(row.category_id)?.slug ?? '',
    category_name: categoryById.get(row.category_id)?.name ?? '',
    direction: row.direction as FinanceEntry['direction'],
    amount: String(row.amount),
    currency: 'IDR',
    description: row.description,
    occurred_on: row.occurred_on,
    created_at: row.created_at
  }));

  return { ok: true, data: items };
}
