'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { getBoardFinanceSummaryAction } from '../actions';
import { financeKeys } from '../api/keys';
import { formatIDR } from '../lib/format';
import { EntryFormDialog } from './entry-form-dialog';
import { listBoardsAction, listCategoriesAction } from '../actions';
import type { FinanceCategory } from '../types';

type Props = {
  boardId: string;
  canWrite: boolean;
};

function amountClass(value: string): string {
  const n = Number(value);
  if (n > 0) return 'text-emerald-600';
  if (n < 0) return 'text-red-600';
  return 'text-muted-foreground';
}

/** PSI-104: the Finance tab content for one board. */
export function BoardFinancePanel({ boardId, canWrite }: Props) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [boards, setBoards] = React.useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = React.useState<FinanceCategory[]>([]);

  const summaryQuery = useQuery({
    queryKey: financeKeys.summary(boardId),
    queryFn: async () => {
      const res = await getBoardFinanceSummaryAction(boardId);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    }
  });

  const summary = summaryQuery.data;

  React.useEffect(() => {
    void listBoardsAction().then((res) => {
      if (res.ok) setBoards(res.data);
    });
    void listCategoriesAction().then((res) => {
      if (res.ok) setCategories(res.data);
    });
  }, []);

  const openAdd = () => {
    if (!canWrite) {
      toast.error('You need finance.write to add an entry');
      return;
    }
    setDialogOpen(true);
  };

  const onSaved = () => {
    void qc.invalidateQueries({ queryKey: financeKeys.summary(boardId) });
  };

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-3 gap-3'>
        <Card>
          <CardHeader>
            <CardTitle className='text-xs text-muted-foreground'>Inflow</CardTitle>
          </CardHeader>
          <CardContent className='text-lg font-semibold text-emerald-600'>
            {summary ? formatIDR(summary.inflow) : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-xs text-muted-foreground'>Outflow</CardTitle>
          </CardHeader>
          <CardContent className='text-lg font-semibold text-red-600'>
            {summary ? formatIDR(summary.outflow) : '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='text-xs text-muted-foreground'>Net</CardTitle>
          </CardHeader>
          <CardContent className={`text-lg font-semibold ${summary ? amountClass(summary.net) : ''}`}>
            {summary ? formatIDR(summary.net) : '—'}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-sm'>By category</CardTitle>
          <CardDescription>{summary?.entryCount ?? 0} entries</CardDescription>
        </CardHeader>
        <CardContent className='space-y-2'>
          {summary && summary.categories.length === 0 ? (
            <p className='text-xs text-muted-foreground'>No entries recorded yet.</p>
          ) : (
            summary?.categories.map((c) => (
              <div key={c.id} className='flex items-center justify-between text-xs'>
                <span className='flex items-center gap-1.5'>
                  <span
                    className='size-2 rounded-full'
                    style={{ backgroundColor: c.color ?? (c.direction === 'inflow' ? '#10B981' : '#EF4444') }}
                  />
                  <span>{c.name}</span>
                  <span className='text-[10px] text-muted-foreground'>({c.count})</span>
                </span>
                <span className={c.direction === 'inflow' ? 'text-emerald-600' : 'text-red-600'}>
                  {c.direction === 'inflow' ? '+' : '−'} {formatIDR(c.total)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className='flex items-center gap-2'>
        {canWrite && (
          <Button size='sm' onClick={openAdd}>
            <Icons.plusCircle className='mr-1.5 h-3.5 w-3.5' />
            Add entry
          </Button>
        )}
        <Button
          variant='outline'
          size='sm'
          render={<Link href='/dashboard/finance' aria-label='View full ledger' />}
        >
          <Icons.billing className='mr-1.5 h-3.5 w-3.5' />
          View full ledger
        </Button>
      </div>

      <EntryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        boards={boards}
        categories={categories}
        entry={null}
        onSaved={onSaved}
        initialBoardId={boardId}
      />
    </div>
  );
}