import { RRule } from 'rrule';
import type { CalendarEvent } from '../types';

/**
 * Expand events with an `rrule` into one instance per occurrence inside
 * [rangeStart, rangeEnd]; non-recurring events pass through unchanged.
 * `rrule` is stored without the "RRULE:" prefix (docs/database-architecture/m4-calendar.md).
 * Indonesia has no DST, so stepping by whole days/weeks/months in UTC lands on
 * the same WIB wall-clock time every occurrence.
 */
export function expandRecurringEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const expanded: CalendarEvent[] = [];

  for (const event of events) {
    if (!event.rrule) {
      expanded.push(event);
      continue;
    }

    const dtstart = new Date(event.starts_at);
    const durationMs = new Date(event.ends_at).getTime() - dtstart.getTime();

    let occurrences: Date[];
    try {
      const options = RRule.parseString(event.rrule.replace(/^RRULE:/, ''));
      const rule = new RRule({ ...options, dtstart });
      occurrences = rule.between(rangeStart, rangeEnd, true);
    } catch {
      // Malformed rrule: fall back to the single stored occurrence rather than dropping the event.
      expanded.push(event);
      continue;
    }

    for (const occurrenceStart of occurrences) {
      expanded.push({
        ...event,
        id: `${event.id}__${occurrenceStart.getTime()}`,
        starts_at: occurrenceStart.toISOString(),
        ends_at: new Date(occurrenceStart.getTime() + durationMs).toISOString()
      });
    }
  }

  return expanded;
}
