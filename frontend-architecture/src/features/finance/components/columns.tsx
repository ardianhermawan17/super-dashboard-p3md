'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { formatDateWIB, formatIDR } from '../lib/format';
import type { FinanceCategory, FinanceEntry } from '../types';

export function buildColumns(
  categories: FinanceCategory[],
  actions: (entry: FinanceEntry) => React.ReactNode
): ColumnDef<FinanceEntry>[] {
  return [
    {
      id: 'direction',
      accessorKey: 'direction',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Direction' />,
      enableColumnFilter: true,
      meta: {
        label: 'Direction',
        variant: 'multiSelect',
        options: [
          { label: 'Inflow', value: 'inflow', icon: Icons.trendingUp },
          { label: 'Outflow', value: 'outflow', icon: Icons.trendingDown }
        ]
      },
      cell: ({ row }) => (
        <Badge variant={row.original.direction === 'inflow' ? 'secondary' : 'destructive'}>
          {row.original.direction === 'inflow' ? (
            <Icons.trendingUp className='size-3' />
          ) : (
            <Icons.trendingDown className='size-3' />
          )}
          {row.original.direction}
        </Badge>
      )
    },
    {
      id: 'category',
      accessorKey: 'category_id',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Category' />,
      enableColumnFilter: true,
      meta: {
        label: 'Category',
        variant: 'multiSelect',
        options: categories.map((c) => ({ label: c.name, value: c.id }))
      },
      cell: ({ row }) => row.original.category_name
    },
    {
      id: 'description',
      accessorKey: 'description',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Description' />,
      cell: ({ row }) => (
        <div className='max-w-[320px] truncate'>
          {row.original.description}
          <span className='text-muted-foreground ml-2 text-xs'>{row.original.board_name}</span>
        </div>
      )
    },
    {
      id: 'occurredOn',
      accessorKey: 'occurred_on',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Date' />,
      enableColumnFilter: true,
      // ponytail: static bound doesn't matter here — DataTableDateFilter picks its own
      // calendar range regardless of meta; nothing else reads meta.range for a date column.
      meta: { label: 'Date', variant: 'dateRange' },
      cell: ({ row }) => formatDateWIB(row.original.occurred_on)
    },
    {
      id: 'amount',
      accessorKey: 'amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Amount' />,
      enableColumnFilter: true,
      // ponytail: static [0, 100_000_000] IDR ceiling for the slider bound, not derived
      // from real data. Upgrade to `getFacetedMinMaxValues()` if entries start exceeding it.
      meta: { label: 'Amount', variant: 'range', range: [0, 100_000_000], unit: 'Rp' },
      cell: ({ row }) => (
        <span className={row.original.direction === 'inflow' ? 'text-primary' : 'text-destructive'}>
          {row.original.direction === 'inflow' ? '+' : '-'}
          {formatIDR(row.original.amount)}
        </span>
      )
    },
    {
      id: 'actions',
      cell: ({ row }) => actions(row.original)
    }
  ];
}
