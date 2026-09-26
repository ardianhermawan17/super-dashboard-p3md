'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { CalendarEvent } from '../types';

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export function DayView({
  currentDate,
  events,
  onSelectEvent
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7:00 to 21:00

  const dayEvents = events.filter((e) => isSameDay(new Date(e.starts_at), currentDate));

  return (
    <div className='rounded-2xl border border-border bg-card overflow-hidden shadow-xs'>
      <div className='divide-y divide-border/60 max-h-[550px] overflow-y-auto bg-background'>
        {hours.map((hour) => {
          const slotEvents = dayEvents.filter((e) => new Date(e.starts_at).getHours() === hour);

          return (
            <div key={hour} className='grid grid-cols-12 min-h-[56px] hover:bg-muted/10'>
              <div className='col-span-2 sm:col-span-1 p-2 text-right text-xs text-muted-foreground font-mono border-r border-border/60'>
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className='col-span-10 sm:col-span-11 p-1.5 space-y-1.5'>
                {slotEvents.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEvent(e)}
                    className={`w-full text-left p-2 rounded-xl text-xs font-medium transition-colors ${
                      e.source === 'google'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-1.5 font-semibold truncate'>
                        {e.source === 'google' && (
                          <Badge variant='outline' className='text-[9px] px-1 py-0'>
                            Google
                          </Badge>
                        )}
                        <span>{e.title}</span>
                      </div>
                      <span className='text-[10px] text-muted-foreground'>
                        {new Date(e.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(e.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {e.location && (
                      <div className='text-[11px] text-muted-foreground mt-0.5'>{e.location}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
