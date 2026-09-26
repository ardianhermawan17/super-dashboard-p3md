'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import type { CalendarEvent } from '../types';

export function AgendaView({
  events,
  onSelectEvent
}: {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const sortedEvents = React.useMemo(() => {
    return [...events].toSorted(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
  }, [events]);

  if (sortedEvents.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-16 border rounded-2xl bg-card text-center'>
        <Icons.calendar className='h-8 w-8 text-muted-foreground/40 mb-2' />
        <p className='text-sm font-medium text-foreground'>No scheduled events</p>
        <p className='text-xs text-muted-foreground'>Your calendar is free for this period.</p>
      </div>
    );
  }

  return (
    <div className='rounded-2xl border border-border bg-card divide-y divide-border/60 overflow-hidden shadow-xs'>
      {sortedEvents.map((e) => {
        const startDate = new Date(e.starts_at);
        const endDate = new Date(e.ends_at);

        return (
          <button
            key={e.id}
            onClick={() => onSelectEvent(e)}
            className='w-full text-left p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3'
          >
            <div className='flex items-start gap-3'>
              <div className='h-10 w-10 rounded-xl bg-primary/10 text-primary flex flex-col items-center justify-center shrink-0 border border-primary/20'>
                <span className='text-[10px] font-semibold uppercase leading-none'>
                  {startDate.toLocaleDateString('default', { month: 'short' })}
                </span>
                <span className='text-sm font-bold leading-tight'>{startDate.getDate()}</span>
              </div>
              <div className='space-y-1'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-semibold text-foreground'>{e.title}</span>
                  {e.source === 'google' ? (
                    <Badge variant='outline' className='text-[9px] px-1.5 text-amber-600 border-amber-500/30'>
                      Google
                    </Badge>
                  ) : (
                    <Badge variant='outline' className='text-[9px] px-1.5'>
                      App
                    </Badge>
                  )}
                  {e.all_day && (
                    <Badge variant='secondary' className='text-[9px] px-1.5'>
                      All Day
                    </Badge>
                  )}
                </div>
                {e.description && (
                  <p className='text-xs text-muted-foreground line-clamp-1'>{e.description}</p>
                )}
                {e.location && (
                  <div className='flex items-center gap-1 text-[11px] text-muted-foreground'>
                    <Icons.mapPin className='h-3 w-3 shrink-0' />
                    <span>{e.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className='text-right text-xs text-muted-foreground shrink-0 pl-13 sm:pl-0'>
              {e.all_day ? (
                <span>All Day</span>
              ) : (
                <span>
                  {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                  {endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
