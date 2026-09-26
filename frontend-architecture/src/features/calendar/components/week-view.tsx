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

export function WeekView({
  currentDate,
  events,
  onSelectEvent
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 to 20:00

  const today = new Date();

  return (
    <div className='rounded-2xl border border-border bg-card overflow-hidden shadow-xs'>
      {/* Week days header */}
      <div className='grid grid-cols-8 border-b border-border bg-muted/20 text-center text-xs font-semibold py-2'>
        <span className='text-muted-foreground'>Time</span>
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className='space-y-0.5'>
              <div className='text-muted-foreground'>
                {d.toLocaleDateString('default', { weekday: 'short' })}
              </div>
              <div
                className={`text-xs mx-auto h-6 w-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground'
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hourly grid */}
      <div className='divide-y divide-border/60 max-h-[550px] overflow-y-auto bg-background'>
        {hours.map((hour) => (
          <div key={hour} className='grid grid-cols-8 min-h-[50px] divide-x divide-border/60'>
            <div className='text-[11px] text-muted-foreground p-1.5 text-center font-mono'>
              {hour.toString().padStart(2, '0')}:00
            </div>
            {weekDays.map((d, dayIdx) => {
              const cellEvents = events.filter((e) => {
                const eventDate = new Date(e.starts_at);
                return isSameDay(eventDate, d) && eventDate.getHours() === hour;
              });

              return (
                <div key={dayIdx} className='p-1 space-y-1 relative hover:bg-muted/10'>
                  {cellEvents.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onSelectEvent(e)}
                      className={`w-full text-left p-1 rounded text-[11px] font-medium truncate block shadow-2xs ${
                        e.source === 'google'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}
                    >
                      {e.source === 'google' && (
                        <Badge variant='outline' className='text-[8px] px-0.5 py-0 mr-1'>
                          G
                        </Badge>
                      )}
                      {e.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
