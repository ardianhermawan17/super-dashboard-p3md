'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/components/icons';
import type { CalendarViewType } from '../types';

export function CalendarHeader({
  currentDate,
  view,
  onViewChange,
  onNavigate
}: {
  currentDate: Date;
  view: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
  onNavigate: (action: 'prev' | 'next' | 'today') => void;
}) {
  const getHeaderLabel = () => {
    const month = currentDate.toLocaleString('default', { month: 'long' });
    const year = currentDate.getFullYear();
    if (view === 'day') {
      return `${currentDate.toLocaleDateString('default', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })}, ${year}`;
    }
    return `${month} ${year}`;
  };

  return (
    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-card shadow-xs'>
      <div className='flex items-center gap-2'>
        <Button variant='outline' size='sm' onClick={() => onNavigate('today')} className='text-xs'>
          Today
        </Button>
        <div className='flex items-center rounded-lg border border-input'>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8 rounded-r-none'
            onClick={() => onNavigate('prev')}
            aria-label='Previous period'
          >
            <Icons.chevronLeft className='h-4 w-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8 rounded-l-none'
            onClick={() => onNavigate('next')}
            aria-label='Next period'
          >
            <Icons.chevronRight className='h-4 w-4' />
          </Button>
        </div>
        <h2 className='text-sm font-semibold text-foreground ml-2'>{getHeaderLabel()}</h2>
      </div>

      <div className='flex items-center gap-2'>
        <Tabs value={view} onValueChange={(v) => onViewChange((v ?? 'month') as CalendarViewType)}>
          <TabsList className='h-8'>
            <TabsTrigger value='month' className='text-xs px-2.5'>
              Month
            </TabsTrigger>
            <TabsTrigger value='week' className='text-xs px-2.5'>
              Week
            </TabsTrigger>
            <TabsTrigger value='day' className='text-xs px-2.5'>
              Day
            </TabsTrigger>
            <TabsTrigger value='agenda' className='text-xs px-2.5'>
              Agenda
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
