const WIB_OFFSET = '+07:00';

/** UTC ISO timestamp -> "27 Sep 2026, 14:30" in WIB. */
export function formatEventDateTimeWIB(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** UTC ISO timestamp -> hour-of-day in WIB (0-23). No DST in Indonesia, so this is exact. */
export function getWibHour(iso: string): number {
  return (new Date(iso).getUTCHours() + 7) % 24;
}

/** UTC ISO timestamp -> "14:30" in WIB. */
export function formatEventTimeWIB(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * `<input type="datetime-local">` value (e.g. "2026-10-01T14:30", read as a WIB
 * wall-clock time regardless of the browser's own timezone) -> UTC ISO string
 * for the wire. Mirrors finance/lib/format.ts's `+07:00` convention.
 */
export function wibInputValueToISO(value: string): string {
  return new Date(`${value}:00${WIB_OFFSET}`).toISOString();
}

/** UTC ISO timestamp -> `<input type="datetime-local">` value showing WIB wall-clock time. */
export function isoToWibInputValue(iso: string): string {
  // en-CA gives YYYY-MM-DD; formatToParts avoids locale punctuation surprises for the time part.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
