import { z } from 'zod';

export const DIRECTIONS = ['inflow', 'outflow'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type FinanceCategory = {
  id: string;
  slug: string;
  name: string;
  direction: Direction | null;
  color: string | null;
  archived: boolean;
};

export type FinanceEntry = {
  id: string;
  board_id: string;
  board_name: string;
  task_id: string | null;
  event_id: string | null;
  category_id: string;
  category_slug: string;
  category_name: string;
  direction: Direction;
  /** Decimal string, e.g. "2000000.00" — never a float on the wire (m10-finance.md). */
  amount: string;
  currency: 'IDR';
  description: string;
  occurred_on: string;
  created_at: string;
};

export type BoardOption = { id: string; name: string };

/** Positive decimal string with at most 2 places — matches `amount numeric(16,2) check (amount > 0)`. */
const amountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, 'Enter a positive amount, e.g. 250000 or 250000.50')
  .refine((v) => Number(v) > 0, 'Amount must be greater than 0');

export const entrySchema = z.object({
  boardId: z.string().uuid('Pick a board'),
  taskId: z.string().uuid().optional(),
  categoryId: z.string().uuid('Pick a category'),
  direction: z.enum(DIRECTIONS),
  amount: amountSchema,
  description: z.string().min(1, 'Description is required').max(240),
  occurredOn: z.string().date('Pick a date')
});
export type EntryInput = z.infer<typeof entrySchema>;

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(80),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only'),
  direction: z.enum(DIRECTIONS).optional(),
  color: z.string().max(20).optional()
});
export type CategoryInput = z.infer<typeof categorySchema>;

export type EntryFilters = {
  page: number;
  perPage: number;
  direction: Direction[];
  category: string[];
  /** [fromMs, toMs] as strings, or empty. */
  occurredOn: [string, string] | null;
  /** [min, max] IDR as strings, or null. */
  amount: [string, string] | null;
};
