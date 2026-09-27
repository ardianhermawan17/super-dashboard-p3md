# Finance (event cashflow) and the event → board → finance streamline

> **Scope:** the finance module (CRUD), the event → board bridge, finance panels on boards and events, overview charts, and the `get_finance` agent tool. Schema: [m10-finance.md](../../database-architecture/m10-finance.md).
> Index: [frontend-architecture/](../README.md) · Data layer: [data-layer-pattern.md](../data-layer-pattern.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)

## The flow a user sees

1. **Calendar** (`/dashboard/calendar`): open "Event President · 17-08-2026" → **Create event board** (PSI-102). The board is named after the event, `boards.event_id` is set, and the event's **group** audience is copied into `board_groups`. Users and roles in the audience are not copied: boards share with users and groups only; the creator adds people by hand.
2. **Kanban** (`/dashboard/kanban/<board>`): the header shows the event date with a link back, and a **Finance** tab (PSI-104): inflow, outflow, net, a per-category breakdown, and "Add entry" pre-filled with the board (and the task when opened from a card).
3. **Finance** (`/dashboard/finance`, PSI-103): every entry the user may read, across boards; filter by event, board, category, direction, date and amount.
4. **Overview** (PSI-106): inflow vs outflow per month and spending by category.

Every screen hides what `finance.*` does not allow; RLS enforces it anyway (C-17).

## Module layout (five-file pattern)

```
src/features/finance/
├── api/
│   ├── types.ts      # FinanceEntry, FinanceCategory, Direction; Zod: entrySchema, entryFilterSchema
│   ├── keys.ts       # financeKeys.all / list(filters) / summary(boardId|eventId) / categories
│   ├── queries.ts    # fetchEntries(db, filters) · fetchSummary(db, scope) · fetchCategories(db)
│   └── actions.ts    # 'use server': createEntry · updateEntry · deleteEntry · upsertCategory · createEventBoard
├── components/       # entries-table, entry-form-sheet, summary-cards, category-dialog, finance-panel
└── lib/format.ts     # formatIDR(amount) → "Rp 2.000.000" (Intl id-ID, IDR, 0 decimals); WIB dates
src/app/dashboard/finance/page.tsx     # Server Component: requirePermission('finance.read'), prefetch, HydrationBoundary
```

Actions validate with the same Zod schema as the form, call `requirePermission('finance.write')` (or `finance.manage` for categories), run as the user, and return `{ ok: true, data } | { ok: false, error }`. Amounts cross the wire as **strings** (`"2000000.00"`) and are parsed with the schema, never as floats.

## Template parts reused

| Need | Template part |
|---|---|
| Ledger list, sorting, paging, URL state | `components/ui/table/data-table*` + `hooks/use-data-table` (nuqs) |
| Filters | `data-table-faceted-filter` (direction, category), `data-table-date-filter` (occurred_on), `data-table-slider-filter` (amount) |
| Create / edit | `useAppForm` + `field.RadioGroupField` (direction), `SelectField` (category), `ComboboxField` (board / event / task), `DatePickerField`, `TextField` (amount, description) in a `Sheet` |
| Delete | `alert-dialog` confirm |
| Categories | `ColorField` + `TextField` in a `Dialog` (`finance.manage`) |
| Totals and charts | `card` + overview `bar-graph` / `pie-graph` with `components/ui/chart` |
| Icons (only `@/components/icons`) | Nav: `Icons.billing` · inflow: `Icons.trendingUp` · outflow: `Icons.trendingDown` · event: `Icons.calendar` · board: `Icons.kanban` |
| Navigation | `nav-config.ts` item "Finance" with `access: { permission: 'finance.read' }`; kbar "Record income or spending…" |

## AI-friendly contract

The in-app assistant (PSI-076) and MCP clients (PSI-073) read finance only through the agent registry, never ad-hoc SQL.

```ts
// src/agent/tools/get-finance.ts  (PSI-105), same shape as get-agenda.ts
input: z.object({
  eventId: z.string().uuid().optional().describe('Limit to one event'),
  boardId: z.string().uuid().optional().describe('Limit to one board'),
  from: z.string().date().optional().describe('YYYY-MM-DD, WIB, inclusive'),
  to: z.string().date().optional().describe('YYYY-MM-DD, WIB, inclusive'),
  category: z.string().optional().describe('Category slug, e.g. venue, sponsorship'),
  limit: z.number().int().min(1).max(50).default(20).describe('Max recent entries'),
})
// output: { currency: 'IDR', totals: { inflow, outflow, net }, byCategory: [{ category, direction, total, count }],
//           recent: [{ occurredOn, direction, amount, category, description, board, event, link }] }
```

- Reads `agent_finance` (security invoker) for totals and `finance_entries` for recent rows: RLS decides what the agent sees.
- Amounts are **decimal strings** plus the currency; direction is explicit; categories are slugs. No creator identities, capped at 50, every row has a deep link, every call lands in `agent_audit_log`.
- Read-only by design (the MCP API is read-only). A write tool (`record_finance_entry`) is a later, separate decision.
