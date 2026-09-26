import * as React from 'react';
import { redirect } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { getSession } from '@/lib/auth/session';
import { getCalendarEventsAction } from '@/features/calendar/actions';
import { CalendarView } from '@/features/calendar/components/calendar-view';

export const metadata = {
  title: 'Agenda Calendar | P3MD Social'
};

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) {
    redirect('/auth/sign-in');
  }

  const { events } = await getCalendarEventsAction();

  return (
    <PageContainer
      pageTitle='Agenda Calendar'
      pageDescription='Schedule, meetings, and team events across roles and groups.'
    >
      <CalendarView initialEvents={events} />
    </PageContainer>
  );
}
