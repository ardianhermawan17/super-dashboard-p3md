import type { EntryFilters } from '../types';

export const financeKeys = {
  all: ['finance'] as const,
  entries: () => [...financeKeys.all, 'entries'] as const,
  list: (filters: EntryFilters) => [...financeKeys.entries(), filters] as const,
  categories: () => [...financeKeys.all, 'categories'] as const,
  boards: () => [...financeKeys.all, 'boards'] as const
};
