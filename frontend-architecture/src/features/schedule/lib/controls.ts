// frontend-architecture/src/features/schedule/lib/controls.ts
// PSI-120 · the URL controls (nuqs in the component, these pure rules underneath) and the two headline
// strings the design fixes:
//
//   "TE 35 w ± 5.9 w (k=2)"        — TE ± k·σ, the operator's measurable range
//   "P(finish ≤ 38 w) = 84.6 %"    — the chance of finishing by the target
//
// Parsing is pure so the server (reading searchParams) and the client agree, and so a hand-edited URL
// can only ever produce a value from the allowed set — never NaN, never an out-of-range k.

import { sigmaRange, targetProbability } from './pert';
import type { Schedule } from './pert';
import { formatDuration } from './view-model';
import type { ScheduleUnit } from './view-model';

export type GanttView = 'Day' | 'Week' | 'Month';

/** `?target=<days>&k=<1|2|3>&unit=<day|week>&view=<Day|Week|Month>` */
export type ScheduleControls = {
  /** The operator's target finish, in days. Null = no target, so no probability is shown. */
  targetDays: number | null;
  k: 1 | 2 | 3;
  unit: ScheduleUnit;
  view: GanttView;
};

export const DEFAULT_SCHEDULE_CONTROLS: ScheduleControls = {
  targetDays: null,
  k: 2,
  unit: 'week',
  view: 'Week'
};

const K_VALUES: readonly number[] = [1, 2, 3];
const UNITS: readonly ScheduleUnit[] = ['day', 'week'];
const VIEWS: readonly GanttView[] = ['Day', 'Week', 'Month'];

/** Next hands repeated params as an array; the first value wins. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A positive, finite number of days, or null. Rejects "0", "-5", "abc", "Infinity". */
function positiveDays(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Read the four controls off a searchParams object. Anything unusable falls back to the default rather
 * than throwing, and `fallbackTargetDays` is used only when the URL has no usable target — it lets the
 * caller seed the target with something board-derived (e.g. the linked event's date).
 */
export function parseScheduleControls(
  params: Record<string, string | string[] | undefined>,
  options: { fallbackTargetDays?: number } = {}
): ScheduleControls {
  const target = positiveDays(first(params.target));
  const fallback = options.fallbackTargetDays;
  const usableFallback =
    fallback !== undefined && Number.isFinite(fallback) && fallback > 0 ? fallback : null;
  const kValue = Number(first(params.k));

  return {
    targetDays: target ?? usableFallback,
    k: (K_VALUES.includes(kValue) ? kValue : DEFAULT_SCHEDULE_CONTROLS.k) as 1 | 2 | 3,
    unit: oneOf(first(params.unit), UNITS, DEFAULT_SCHEDULE_CONTROLS.unit),
    view: oneOf(first(params.view), VIEWS, DEFAULT_SCHEDULE_CONTROLS.view)
  };
}

/** "TE 35 w ± 5.9 w (k=2)" — the expected finish with its uncertainty, in the chosen unit. */
export function formatRangeHeadline(
  schedule: Schedule,
  controls: Pick<ScheduleControls, 'k' | 'unit'>
): string {
  // Use the engine's own range rather than re-deriving k·σ here, so the headline and the numbers the
  // table shows can never drift apart.
  const range = sigmaRange(schedule, controls.k);
  const spread = range.high - range.expected; // = k·σ
  return `TE ${formatDuration(range.expected, controls.unit)} ± ${formatDuration(spread, controls.unit)} (k=${controls.k})`;
}

/** "P(finish ≤ 38 w) = 84.6 %", or null when the operator has not set a target. */
export function formatTargetProbability(
  schedule: Schedule,
  controls: Pick<ScheduleControls, 'targetDays' | 'unit'>
): string | null {
  if (controls.targetDays === null) return null;
  const { probability } = targetProbability(schedule, controls.targetDays);
  const percent = (probability * 100).toFixed(1);
  return `P(finish ≤ ${formatDuration(controls.targetDays, controls.unit)}) = ${percent} %`;
}
