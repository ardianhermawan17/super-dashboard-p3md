// supabase/functions/google-calendar/mapper.ts
// Pure mapper function converting Google Calendar API event items into internal event records.

export type GoogleEventItem = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  recurrence?: string[];
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
};

export type MappedGoogleEvent = {
  calendar_id: string;
  google_event_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  rrule: string | null;
  html_link: string | null;
};

export function mapGoogleEvent(calId: string, item: GoogleEventItem): MappedGoogleEvent | null {
  // 1. Skip cancelled events
  if (item.status === 'cancelled') {
    return null;
  }

  // 2. Skip our own pushed events (they have extendedProperties.private.p3md_event_id)
  if (item.extendedProperties?.private?.p3md_event_id) {
    return null;
  }

  const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);

  let startsAt: string;
  let endsAt: string;

  if (isAllDay) {
    // All-day event: start.date at 00:00:00+07:00 (Asia/Jakarta)
    startsAt = `${item.start!.date}T00:00:00+07:00`;
    // Google all-day end.date is exclusive. Use end.date or fallback to start.date at 23:59:59+07:00
    if (item.end?.date) {
      endsAt = `${item.end.date}T00:00:00+07:00`;
    } else {
      endsAt = `${item.start!.date}T23:59:59+07:00`;
    }
  } else {
    startsAt = item.start?.dateTime ?? new Date().toISOString();
    endsAt = item.end?.dateTime ?? startsAt;
  }

  const rrule = item.recurrence && item.recurrence.length > 0
    ? item.recurrence[0].replace(/^RRULE:/i, '')
    : null;

  return {
    calendar_id: calId,
    google_event_id: item.id,
    title: item.summary?.trim() || '(No Title)',
    description: item.description ?? null,
    location: item.location ?? null,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: isAllDay,
    rrule,
    html_link: item.htmlLink ?? null,
  };
}
