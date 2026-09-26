import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { createEvents, type EventAttributes } from 'ics';

export async function GET(
  _request: Request,
  props: { params: Promise<{ token: string }> }
) {
  const { token } = await props.params;

  if (!token) {
    return new Response('Missing feed token', { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: tokenRow, error: tokenError } = await supabase
    .from('calendar_feed_tokens')
    .select('user_id')
    .eq('token', token)
    .single();

  if (tokenError || !tokenRow) {
    return new Response('Calendar feed not found', { status: 404 });
  }

  const now = Date.now();
  const fromDate = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const toDate = new Date(now + 180 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error: eventsError } = await supabase.rpc('events_for_user', {
    p_user: tokenRow.user_id,
    p_from: fromDate,
    p_to: toDate
  });

  if (eventsError) {
    return new Response('Failed to retrieve calendar events', { status: 500 });
  }

  const icsEvents: EventAttributes[] = (events ?? []).map((e) => {
    const start = new Date(e.starts_at);
    const end = new Date(e.ends_at);

    return {
      title: e.title,
      description: e.description ?? '',
      location: e.location ?? '',
      uid: e.id,
      start: [
        start.getUTCFullYear(),
        start.getUTCMonth() + 1,
        start.getUTCDate(),
        start.getUTCHours(),
        start.getUTCMinutes()
      ],
      end: [
        end.getUTCFullYear(),
        end.getUTCMonth() + 1,
        end.getUTCDate(),
        end.getUTCHours(),
        end.getUTCMinutes()
      ],
      startInputType: 'utc',
      startOutputType: 'utc',
      endInputType: 'utc',
      endOutputType: 'utc',
      status: 'CONFIRMED'
    };
  });

  if (icsEvents.length === 0) {
    const emptyCalendar = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//P3MD Social//Agenda Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:P3MD Agenda',
      'END:VCALENDAR'
    ].join('\r\n');

    return new Response(emptyCalendar, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="calendar.ics"',
        'Cache-Control': 'private, max-age=900'
      }
    });
  }

  const { error, value } = createEvents(icsEvents, {
    calName: 'P3MD Agenda'
  });

  if (error || !value) {
    return new Response('Failed to generate ICS feed', { status: 500 });
  }

  return new Response(value, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="calendar.ics"',
      'Cache-Control': 'private, max-age=900'
    }
  });
}
