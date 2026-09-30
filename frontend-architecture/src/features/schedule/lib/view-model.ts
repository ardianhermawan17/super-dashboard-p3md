// frontend-architecture/src/features/schedule/lib/view-model.ts
// PSI-120 · the pure seam between the PSI-119 engine and the two views: Gantt bars and the network
// table. Everything here is deterministic and DOM-free, so the React components stay thin and the
// fiddly parts (dates, units, sub-task ordering) are testable without a browser.
//
// Units: the engine works in DAYS and days² (brief §2 D7). Weeks exist only at the display edge, so
// every row carries days and the view converts with durationInUnit / varianceInUnit.

import { slackBand } from './pert';
import type { PertTask, Schedule, TaskLink } from './pert';
import { KIND_PROGRESS } from '../types';
import type { Estimate, GanttRow, NetworkRow, ScheduleTask } from '../types';

/** Indonesia has no DST, so a fixed offset is exact — the same convention as calendar/lib/format.ts. */
const WIB_OFFSET = '+07:00';
const MS_PER_DAY = 86_400_000;

export type ScheduleUnit = 'day' | 'week';

export type ScheduleViewInput = {
  /** The engine's output. `order` drives the row order. */
  schedule: Schedule;
  /** Every task the board has, including ones with no estimate (they come back as "unscheduled"). */
  tasks: ScheduleTask[];
  links: TaskLink[];
  /** `boards.project_start`, a WIB calendar date (M13). */
  projectStart: string;
  /** The operator's k, for the slack band (e.g. 2 → slack ∓ 2σ). */
  k: number;
};

/** A duration: days → the display unit. */
export function durationInUnit(days: number, unit: ScheduleUnit): number {
  return unit === 'week' ? days / 7 : days;
}

/** A variance: days² → the display unit². Divides by 7², not 7 — variance is squared. */
export function varianceInUnit(daysSquared: number, unit: ScheduleUnit): number {
  return unit === 'week' ? daysSquared / 49 : daysSquared;
}

/** "35 w" / "20.6 d" — one decimal at most, and no trailing ".0". */
export function formatDuration(days: number, unit: ScheduleUnit): string {
  const value = Math.round(durationInUnit(days, unit) * 10) / 10;
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${text} ${unit === 'week' ? 'w' : 'd'}`;
}

/**
 * `project_start` + N days as a UTC ISO instant. The offset is applied in milliseconds from WIB
 * midnight, so a fractional ES keeps its exact position instead of being rounded to a day boundary.
 */
function atDayOffset(projectStart: string, days: number): string {
  const dateOnly = projectStart.slice(0, 10); // tolerate a full ISO timestamp
  const midnight = new Date(`${dateOnly}T00:00:00${WIB_OFFSET}`);
  return new Date(midnight.getTime() + days * MS_PER_DAY).toISOString();
}

/**
 * The view order: the engine's topological order, except that a parent is immediately followed by its
 * sub-tasks (design: "Sub-tasks sit right after their parent"). One level only, per M12.
 */
export function orderTasksForView(order: string[], tasks: ScheduleTask[]): ScheduleTask[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ordered = new Set(order);
  const childrenByParent = new Map<string, ScheduleTask[]>();
  for (const task of tasks) {
    if (!task.parentId) continue;
    const siblings = childrenByParent.get(task.parentId) ?? [];
    siblings.push(task);
    childrenByParent.set(task.parentId, siblings);
  }

  const seen = new Set<string>();
  const out: ScheduleTask[] = [];
  const emit = (task: ScheduleTask) => {
    out.push(task);
    seen.add(task.id);
    for (const child of childrenByParent.get(task.id) ?? []) {
      if (seen.has(child.id)) continue;
      out.push(child);
      seen.add(child.id);
    }
  };

  for (const id of order) {
    const task = byId.get(id);
    if (!task || seen.has(id)) continue;
    // A child whose parent is also on this view is emitted next to the parent, wherever the parent
    // falls in the topological order (a child can be ordered before its parent by the engine).
    if (task.parentId && ordered.has(task.parentId)) continue;
    emit(task);
  }
  return out;
}

/** Tasks the engine never saw — no estimate, so nothing to schedule. Not an error (design §PSI-119). */
export function unscheduledTasks(
  all: ScheduleTask[],
  scheduledIds: Iterable<string>
): ScheduleTask[] {
  const scheduled = new Set(scheduledIds);
  return all.filter((task) => !scheduled.has(task.id));
}

/**
 * The engine's input: only the tasks that carry an estimate. A task with none cannot be scheduled — it
 * belongs in the "unscheduled" list instead, and is deliberately NOT an error (M12's est_* columns are
 * nullable, guarded by an all-or-none check).
 */
export function toPertTasks(tasks: ScheduleTask[]): PertTask[] {
  return tasks
    .filter((task): task is ScheduleTask & { estimate: Estimate } => task.estimate !== null)
    .map((task) => ({ id: task.id, a: task.estimate.a, m: task.estimate.m, b: task.estimate.b }));
}

function scheduledTasks(input: ScheduleViewInput): ScheduleTask[] {
  const inSchedule = input.tasks.filter((task) => input.schedule.nodes[task.id] !== undefined);
  return orderTasksForView(input.schedule.order, inSchedule);
}

function predecessors(links: TaskLink[], id: string): string[] {
  return links.filter((link) => link.to === id).map((link) => link.from);
}

/** One bar per scheduled task. Read-only: the engine computes the dates, so bars drag nothing. */
export function toGanttRows(input: ScheduleViewInput): GanttRow[] {
  return scheduledTasks(input).map((task) => {
    const node = input.schedule.nodes[task.id];
    return {
      id: task.id,
      name: task.parentId ? `↳ ${task.title}` : task.title,
      start: atDayOffset(input.projectStart, node.es),
      end: atDayOffset(input.projectStart, node.ef),
      progress: KIND_PROGRESS[task.kind],
      dependencies: predecessors(input.links, task.id),
      isSubtask: Boolean(task.parentId),
      // Membership of `criticalPath`, never the node's own `critical` flag: on a duration tie the
      // reported path is the one carrying the larger variance, so a zero-slack task off that path
      // still reports critical: true (see PSI-119's entry).
      criticalBar: input.schedule.criticalPath.includes(task.id),
      esDays: node.es,
      efDays: node.ef,
      slackDays: node.slack,
      slackBand: slackBand(node, input.k)
    };
  });
}

/** The network table: a/m/b plus every computed column, in days (convert at render). */
export function toNetworkRows(input: ScheduleViewInput): NetworkRow[] {
  const onPath = new Set(input.schedule.criticalPath);
  const rows: NetworkRow[] = [];
  for (const task of scheduledTasks(input)) {
    const node = input.schedule.nodes[task.id];
    const estimate = task.estimate;
    // A scheduled task always has an estimate, because the engine only ever sees estimated tasks; this
    // guard keeps the types honest instead of asserting, and would rather drop a row than print a null.
    if (estimate === null) continue;
    rows.push({
      id: task.id,
      name: task.parentId ? `↳ ${task.title}` : task.title,
      isSubtask: Boolean(task.parentId),
      kind: task.kind,
      a: estimate.a,
      m: estimate.m,
      b: estimate.b,
      te: node.te,
      variance: node.variance,
      sd: node.sd,
      es: node.es,
      ef: node.ef,
      ls: node.ls,
      lf: node.lf,
      slack: node.slack,
      slackBand: slackBand(node, input.k),
      critical: node.critical,
      onCriticalPath: onPath.has(task.id)
    });
  }
  return rows;
}
