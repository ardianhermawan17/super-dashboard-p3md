'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { toast } from 'sonner';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { DataTableSkeleton } from '@/components/ui/table/data-table-skeleton';
import { useDataTable } from '@/hooks/use-data-table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { financeKeys } from '../api/keys';
import {
  deleteEntryAction,
  listBoardsAction,
  listCategoriesAction,
  listEntriesAction
} from '../actions';
import { buildColumns } from './columns';
import { EntryFormDialog } from './entry-form-dialog';
import { CategoryDialog } from './category-dialog';
import type { EntryFilters, FinanceEntry } from '../types';

type Props = { canWrite: boolean; canManage: boolean };

function splitRange(value: string | null): [string, string] | null {
  if (!value) return null;
  const parts = value.split(',');
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

export function EntriesTable({ canWrite, canManage }: Props) {
  const queryClient = useQueryClient();

  const [page] = useQueryState('page', parseAsInteger.withDefault(1));
  const [perPage] = useQueryState('perPage', parseAsInteger.withDefault(10));
  const [direction] = useQueryState(
    'direction',
    parseAsArrayOf(parseAsString, ',').withDefault([])
  );
  const [category] = useQueryState('category', parseAsArrayOf(parseAsString, ',').withDefault([]));
  const [occurredOnRaw] = useQueryState('occurredOn', parseAsString);
  const [amountRaw] = useQueryState('amount', parseAsString);
  const [newEntry, setNewEntry] = useQueryState('new');

  const filters: EntryFilters = {
    page,
    perPage,
    direction: direction as EntryFilters['direction'],
    category,
    occurredOn: splitRange(occurredOnRaw),
    amount: splitRange(amountRaw)
  };

  const entriesQuery = useQuery({
    queryKey: financeKeys.list(filters),
    queryFn: async () => {
      const res = await listEntriesAction(filters);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    }
  });
  const categoriesQuery = useQuery({
    queryKey: financeKeys.categories(),
    queryFn: async () => {
      const res = await listCategoriesAction();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    }
  });
  const boardsQuery = useQuery({
    queryKey: financeKeys.boards(),
    queryFn: async () => {
      const res = await listBoardsAction();
      if (!res.ok) throw new Error(res.error);
      return res.data;
    }
  });

  const [editingEntry, setEditingEntry] = React.useState<FinanceEntry | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [deletingEntry, setDeletingEntry] = React.useState<FinanceEntry | null>(null);

  // The kbar action ("Record income or spending") lands here with ?new=1.
  React.useEffect(() => {
    if (newEntry === '1') {
      setEditingEntry(null);
      setFormOpen(true);
      void setNewEntry(null);
    }
  }, [newEntry, setNewEntry]);

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: financeKeys.all });
  }, [queryClient]);

  const handleDelete = async () => {
    if (!deletingEntry) return;
    const res = await deleteEntryAction(deletingEntry.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Entry deleted');
    setDeletingEntry(null);
    invalidate();
  };

  const columns = React.useMemo(
    () =>
      buildColumns(categoriesQuery.data ?? [], (entry) =>
        canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button {...props} variant='ghost' size='sm' className='h-8 w-8 p-0'>
                  <Icons.dots className='h-4 w-4' />
                </Button>
              )}
            />
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onClick={() => {
                  setEditingEntry(entry);
                  setFormOpen(true);
                }}
              >
                <Icons.edit className='mr-2 h-4 w-4' />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className='text-destructive'
                onClick={() => setDeletingEntry(entry)}
              >
                <Icons.trash className='mr-2 h-4 w-4' />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null
      ),
    [categoriesQuery.data, canWrite]
  );

  const total = entriesQuery.data?.total ?? 0;
  const { table } = useDataTable({
    data: entriesQuery.data?.items ?? [],
    columns,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    shallow: true,
    debounceMs: 500,
    initialState: { columnPinning: { right: ['actions'] } }
  });

  if (entriesQuery.isLoading) {
    return <DataTableSkeleton columnCount={5} rowCount={perPage} filterCount={4} />;
  }

  return (
    <div className='space-y-4'>
      <DataTable table={table}>
        <DataTableToolbar table={table}>
          {canManage && (
            <Button variant='outline' size='sm' onClick={() => setCategoryDialogOpen(true)}>
              <Icons.adjustments className='mr-2 h-4 w-4' />
              Categories
            </Button>
          )}
          {canWrite && (
            <Button
              size='sm'
              onClick={() => {
                setEditingEntry(null);
                setFormOpen(true);
              }}
            >
              <Icons.add className='mr-2 h-4 w-4' />
              Add entry
            </Button>
          )}
        </DataTableToolbar>
      </DataTable>

      {canWrite && (
        <EntryFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          boards={boardsQuery.data ?? []}
          categories={categoriesQuery.data ?? []}
          entry={editingEntry}
          onSaved={invalidate}
        />
      )}

      {canManage && (
        <CategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          onSaved={invalidate}
        />
      )}

      <AlertDialog
        open={Boolean(deletingEntry)}
        onOpenChange={(open) => !open && setDeletingEntry(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
