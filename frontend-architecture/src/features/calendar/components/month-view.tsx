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

export function MonthView({
  currentDate,
  events,
  onSelectEvent
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: { date: Date; isCurrentMonth: boolean; dayNum: number }[] = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
      dayNum: daysInPrevMonth - i
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
      dayNum: i
    });
  }

  // Next month padding to complete 35/42 cells
  const remaining = 35 - days.length >= 0 ? 35 - days.length : 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
      dayNum: i
    });
  }

  const today = new Date();

  return (
    <div className='rounded-2xl border border-border bg-card overflow-hidden shadow-xs'>
      <div className='grid grid-cols-7 border-b border-border bg-muted/20 text-center text-xs font-semibold text-muted-foreground py-2'>
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      <div className='grid grid-cols-7 auto-rows-[110px] divide-x divide-y divide-border/60 bg-background'>
        {days.map((item, idx) => {
          const isToday = isSameDay(item.date, today);
          const dayEvents = events.filter((e) => isSameDay(new Date(e.starts_at), item.date));

          return (
            <div
              key={idx}
              className={`p-1.5 flex flex-col justify-between transition-colors overflow-hidden ${
                !item.isCurrentMonth ? 'bg-muted/10 opacity-50' : 'hover:bg-muted/20'
              }`}
            >
              <div className='flex items-center justify-between'>
                <span
                  className={`text-xs font-medium h-5 w-5 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-primary text-primary-foreground font-bold'
                      : 'text-foreground'
                  }`}
                >
                  {item.dayNum}
                </span>
                {dayEvents.length > 2 && (
                  <span className='text-[10px] text-muted-foreground'>
                    +{dayEvents.length - 2}
                  </span>
                )}
              </div>

              <div className='space-y-1 mt-1 flex-1 overflow-y-auto'>
                {dayEvents.slice(0, 2).map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onSelectEvent(e)}
                    className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate block transition-opacity hover:opacity-80 ${
                      e.source === 'google'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}
                  >
                    {e.source === 'google' && (
                      <Badge variant='outline' className='text-[9px] px-1 py-0 mr-1'>
                        G
                      </Badge>
                    )}
                    {e.title}
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
