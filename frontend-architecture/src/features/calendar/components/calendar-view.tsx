'use client';

import * as React from 'react';
import { CalendarHeader } from './calendar-header';
import { MonthView } from './month-view';
import { WeekView } from './week-view';
import { DayView } from './day-view';
import { AgendaView } from './agenda-view';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import type { CalendarEvent, CalendarViewType } from '../types';

export function CalendarView({ initialEvents }: { initialEvents: CalendarEvent[] }) {
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [view, setView] = React.useState<CalendarViewType>('month');
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);

  const handleNavigate = (action: 'prev' | 'next' | 'today') => {
    if (action === 'today') {
      setCurrentDate(new Date());
      return;
    }

    const next = new Date(currentDate);
    const direction = action === 'next' ? 1 : -1;

    switch (view) {
      case 'month':
        next.setMonth(next.getMonth() + direction);
        break;
      case 'week':
        next.setDate(next.getDate() + direction * 7);
        break;
      case 'day':
      case 'agenda':
        next.setDate(next.getDate() + direction);
        break;
    }
    setCurrentDate(next);
  };

  return (
    <div className='space-y-4'>
      <CalendarHeader
        currentDate={currentDate}
        view={view}
        onViewChange={setView}
        onNavigate={handleNavigate}
      />

      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          events={initialEvents}
          onSelectEvent={setSelectedEvent}
        />
      )}

      {view === 'week' && (
        <WeekView
          currentDate={currentDate}
          events={initialEvents}
          onSelectEvent={setSelectedEvent}
        />
      )}

      {view === 'day' && (
        <DayView
          currentDate={currentDate}
          events={initialEvents}
          onSelectEvent={setSelectedEvent}
        />
      )}

      {view === 'agenda' && (
        <AgendaView events={initialEvents} onSelectEvent={setSelectedEvent} />
      )}

      {/* Event Details Dialog */}
      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <div className='flex items-center gap-2'>
              <DialogTitle>{selectedEvent?.title}</DialogTitle>
              {selectedEvent?.source === 'google' && (
                <Badge variant='outline' className='text-[9px] text-amber-600 border-amber-500/30'>
                  Google Event
                </Badge>
              )}
            </div>
            <DialogDescription>
              {selectedEvent?.all_day ? (
                <span>All Day Event</span>
              ) : selectedEvent ? (
                <span>
                  {new Date(selectedEvent.starts_at).toLocaleString()} –{' '}
                  {new Date(selectedEvent.ends_at).toLocaleString()}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-3 py-2 text-xs'>
            {selectedEvent?.description && (
              <div className='p-3 rounded-lg bg-muted/30 border border-muted text-foreground leading-relaxed whitespace-pre-wrap'>
                {selectedEvent.description}
              </div>
            )}

            {selectedEvent?.location && (
              <div className='flex items-center gap-2 text-muted-foreground'>
                <Icons.mapPin className='h-4 w-4 shrink-0 text-primary' />
                <span>{selectedEvent.location}</span>
              </div>
            )}

            {selectedEvent?.source === 'google' && (
              <div className='text-[11px] text-muted-foreground p-2 rounded-lg bg-amber-500/5 border border-amber-500/20'>
                This event is synced from Google Calendar and is read-only.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
