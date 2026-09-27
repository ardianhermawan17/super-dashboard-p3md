// supabase/functions/google-calendar/push.ts
// Push handler: app events -> linked shared Google calendars (PSI-066).
// Spec: docs/backend-architecture/google-integration.md § "/push: app -> Google (triggered, per event)"

export const GOOGLE_CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export type AppEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  rrule: string | null;
  source?: string;
};

export type GooglePushPayload = {
  id: string;
  summary: string;
  description: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  recurrence?: string[];
  extendedProperties: {
    private: {
      p3md_event_id: string;
    };
  };
};

export type PushLink = {
  google_calendar_id: string;
  google_event_id: string;
  html_link?: string | null;
};

export type CalendarPushTarget = {
  id: string;
  calendar_id: string;
  name: string;
  direction: 'pull' | 'push' | 'both';
  role_id: string | null;
  group_id: string | null;
  enabled: boolean;
};

export type EventAudienceRow = {
  event_id: string;
  user_id: string | null;
  role_id: string | null;
  group_id: string | null;
};

/**
 * Deterministic Google event ID: UUID hex characters (dashes stripped).
 * UUID hex (0-9, a-f) is a subset of base32hex, which Google accepts as valid custom IDs.
 */
export function toGoogleId(uuid: string): string {
  return uuid.replaceAll('-', '').toLowerCase();
}

/**
 * Map an internal app event into the Google Calendar API format.
 */
export function toGoogleEvent(ev: AppEvent): GooglePushPayload {
  const gid = toGoogleId(ev.id);
  const descSuffix = '\n\n— Managed in P3MD. Edit it in the app.';
  const description = `${ev.description ?? ''}${descSuffix}`.trim();

  let start: GooglePushPayload['start'];
  let end: GooglePushPayload['end'];

  if (ev.all_day) {
    // All-day: YYYY-MM-DD
    start = { date: ev.starts_at.slice(0, 10) };
    end = { date: ev.ends_at.slice(0, 10) };
  } else {
    // Timed: ISO timestamp + Asia/Jakarta timezone
    start = { dateTime: ev.starts_at, timeZone: 'Asia/Jakarta' };
    end = { dateTime: ev.ends_at, timeZone: 'Asia/Jakarta' };
  }

  const payload: GooglePushPayload = {
    id: gid,
    summary: ev.title,
    description,
    start,
    end,
    extendedProperties: {
      private: {
        p3md_event_id: ev.id,
      },
    },
  };

  if (ev.location) {
    payload.location = ev.location;
  }

  if (ev.rrule) {
    // events.rrule stores the rule body without prefix; Google expects "RRULE:<rule>"
    payload.recurrence = [`RRULE:${ev.rrule}`];
  }

  return payload;
}

type GFetchFn = (scope: string, url: string, init?: RequestInit) => Promise<Response>;

/**
 * Push an event to Google Calendar or delete it, reconciling desired vs existing links.
 */
export async function reconcilePush(args: {
  op: 'upsert' | 'delete';
  eventId: string;
  links?: PushLink[];
  event?: AppEvent | null;
  audience?: EventAudienceRow[];
  calendars?: CalendarPushTarget[];
  gfetchFn: GFetchFn;
  upsertLinkFn?: (link: PushLink) => Promise<void>;
  deleteLinkFn?: (calendarId: string, eventId: string) => Promise<void>;
}): Promise<{ pushed: number; deleted: number; errors?: string[] }> {
  const { op, eventId, links = [], event, audience = [], calendars = [], gfetchFn, upsertLinkFn, deleteLinkFn } = args;
  const gid = toGoogleId(eventId);
  let pushedCount = 0;
  let deletedCount = 0;
  const errors: string[] = [];

  // --------------------------------------------------------------------------
  // 1. DELETE OP: Delete Google events for all passed links
  // --------------------------------------------------------------------------
  if (op === 'delete') {
    for (const link of links) {
      try {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(link.google_calendar_id)}/events/${encodeURIComponent(link.google_event_id)}`;
        const res = await gfetchFn(GOOGLE_CALENDAR_EVENTS_SCOPE, url, { method: 'DELETE' });
        // 404/410 = already gone, count as success
        if (res.ok || res.status === 404 || res.status === 410) {
          deletedCount++;
        } else {
          const errText = await res.text();
          errors.push(`failed to delete event on ${link.google_calendar_id}: ${errText.slice(0, 200)}`);
        }
      } catch (err) {
        errors.push(`network error deleting on ${link.google_calendar_id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { pushed: 0, deleted: deletedCount, errors: errors.length ? errors : undefined };
  }

  // --------------------------------------------------------------------------
  // 2. UPSERT OP: Reconcile desired vs existing links
  // --------------------------------------------------------------------------
  if (!event) {
    return { pushed: 0, deleted: 0, errors: ['event not found'] };
  }

  // Find desired target calendars: enabled, direction in ('push','both'), and matching audience role/group
  const audienceRoleIds = new Set(audience.map((a) => a.role_id).filter(Boolean));
  const audienceGroupIds = new Set(audience.map((a) => a.group_id).filter(Boolean));

  const desiredCalendars = calendars.filter((cal) => {
    if (!cal.enabled || !['push', 'both'].includes(cal.direction)) return false;
    const roleMatch = cal.role_id && audienceRoleIds.has(cal.role_id);
    const groupMatch = cal.group_id && audienceGroupIds.has(cal.group_id);
    return Boolean(roleMatch || groupMatch);
  });

  const desiredCalIds = new Set(desiredCalendars.map((c) => c.calendar_id));
  const existingLinksMap = new Map(links.map((l) => [l.google_calendar_id, l]));

  const payload = toGoogleEvent(event);

  // A. Push to each desired calendar
  for (const cal of desiredCalendars) {
    const calId = cal.calendar_id;
    try {
      // POST first with deterministic ID
      const postUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;
      let res = await gfetchFn(GOOGLE_CALENDAR_EVENTS_SCOPE, postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let eventData: { htmlLink?: string } | null = null;

      if (res.status === 409) {
        // Already exists -> PUT update
        const putUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(gid)}`;
        res = await gfetchFn(GOOGLE_CALENDAR_EVENTS_SCOPE, putUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        errors.push(`failed to push to ${calId}: ${errText.slice(0, 200)}`);
        continue;
      }

      eventData = await res.json();
      pushedCount++;

      // Upsert link row in database
      if (upsertLinkFn) {
        await upsertLinkFn({
          google_calendar_id: calId,
          google_event_id: gid,
          html_link: eventData?.htmlLink ?? null,
        });
      }
    } catch (err) {
      errors.push(`exception pushing to ${calId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // B. Delete links that are no longer desired (audience changed or calendar unlinked)
  for (const [calId, link] of existingLinksMap.entries()) {
    if (!desiredCalIds.has(calId)) {
      try {
        const delUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(link.google_event_id)}`;
        const res = await gfetchFn(GOOGLE_CALENDAR_EVENTS_SCOPE, delUrl, { method: 'DELETE' });
        if (res.ok || res.status === 404 || res.status === 410) {
          deletedCount++;
          if (deleteLinkFn) {
            await deleteLinkFn(calId, eventId);
          }
        }
      } catch (err) {
        errors.push(`error cleaning up unneeded link on ${calId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    pushed: pushedCount,
    deleted: deletedCount,
    errors: errors.length ? errors : undefined,
  };
}
