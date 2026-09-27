'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
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
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { createEventBoardAction } from '../actions';
import { getEventFinanceSummaryAction } from '@/features/finance/actions';
import { formatIDR } from '@/features/finance/lib/format';
import type { CalendarEvent, CalendarViewType } from '../types';

export function CalendarView({
  initialEvents,
  canCreateBoard = false,
  canReadFinance = false
}: {
  initialEvents: CalendarEvent[];
  canCreateBoard?: boolean;
  canReadFinance?: boolean;
}) {
  const router = useRouter();
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const [view, setView] = React.useState<CalendarViewType>('month');
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
  const [creatingBoard, setCreatingBoard] = React.useState(false);
  const [boardError, setBoardError] = React.useState<string | null>(null);
  const [eventFinance, setEventFinance] = React.useState<{
    inflow: string;
    outflow: string;
    net: string;
    entryCount: number;
  } | null>(null);

  const openBoard = (boardId: string) => {
    router.push(`/dashboard/kanban?boardId=${boardId}`);
  };

  // PSI-104: fetch the event's finance net when a finance-reader selects an event.
  React.useEffect(() => {
    if (!selectedEvent || !canReadFinance) {
      setEventFinance(null);
      return;
    }
    let cancelled = false;
    void getEventFinanceSummaryAction(selectedEvent.id).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setEventFinance({
          inflow: res.data.inflow,
          outflow: res.data.outflow,
          net: res.data.net,
          entryCount: res.data.entryCount
        });
      } else {
        setEventFinance(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedEvent, canReadFinance]);

  const handleCreateBoard = async () => {
    if (!selectedEvent) return;
    setCreatingBoard(true);
    setBoardError(null);
    const res = await createEventBoardAction(selectedEvent.id);
    setCreatingBoard(false);
    if (!res.ok || !res.boardId) {
      setBoardError(res.error ?? 'Failed to create board');
      return;
    }
    openBoard(res.boardId);
  };

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

              {/* PSI-102: board link / creation */}
                    {selectedEvent && selectedEvent.source !== 'google' && (
                      <div className='flex items-center gap-2 pt-1'>
                        {selectedEvent.board_id ? (
                          <Button variant='default' size='sm' onClick={() => openBoard(selectedEvent.board_id!)}>
                            <Icons.kanban className='mr-1.5 h-3.5 w-3.5' />
                            Open board
                          </Button>
                        ) : canCreateBoard ? (
                          <>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={handleCreateBoard}
                              disabled={creatingBoard}
                            >
                              {creatingBoard ? (
                                <Icons.spinner className='mr-1.5 h-3.5 w-3.5 animate-spin' />
                              ) : (
                                <Icons.kanban className='mr-1.5 h-3.5 w-3.5' />
                              )}
                              Create event board
                            </Button>
                            {boardError && <span className='text-[11px] text-red-600'>{boardError}</span>}
                          </>
                        ) : null}
                      </div>
                    )}

                    {/* PSI-104: event finance summary + links (finance.read only) */}
                    {selectedEvent && canReadFinance && (
                      <div className='rounded-lg border border-muted bg-muted/20 p-3'>
                        <div className='flex items-center justify-between'>
                          <span className='flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground'>
                            <Icons.billing className='h-3.5 w-3.5' />
                            Finance {eventFinance ? `· ${eventFinance.entryCount} entries` : ''}
                          </span>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 px-2 text-[11px]'
                            onClick={() => router.push('/dashboard/finance')}
                          >
                            View ledger
                          </Button>
                        </div>
                        {eventFinance ? (
                          <div className='mt-2 flex items-center gap-4 text-sm'>
                            <span className='text-emerald-600'>In {formatIDR(eventFinance.inflow)}</span>
                            <span className='text-red-600'>Out {formatIDR(eventFinance.outflow)}</span>
                            <span
                              className={`font-semibold ${
                                Number(eventFinance.net) >= 0 ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              Net {formatIDR(eventFinance.net)}
                            </span>
                          </div>
                        ) : (
                          <p className='mt-2 text-xs text-muted-foreground'>No finance entries for this event.</p>
                        )}
                      </div>
                    )}
              </div>
                </DialogContent>
                </Dialog>
                </div>
                );
              }
