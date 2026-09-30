// frontend-architecture/src/features/schedule/lib/view-model.test.ts
// PSI-120 · the pure seam between the PSI-119 engine and the two views (Gantt rows, network table).
// These tests are the ones the future React components are allowed to rely on.
//
// Numbers come from the brief's 38-week fixture (§3) — the same fixture pert.test.ts asserts — so a
// regression in the engine shows up here too. Durations are days; the fixture is authored in weeks.

import { describe, expect, test } from 'bun:test';
import { computeSchedule } from './pert';
import {
  durationInUnit,
  formatDuration,
  orderTasksForView,
  toGanttRows,
  toNetworkRows,
  toPertTasks,
  unscheduledTasks,
  varianceInUnit
} from './view-model';
import type { ScheduleTask } from '../types';

const W = 7;
const PROJECT_START = '2026-10-01'; // a WIB calendar date, as boards.project_start stores it

/** A(4,8,12), B(6,9,18) after A, C(5,6,7) after A, D(10,12,20) after B and C, E(3,4,5) after D. */
const tasks: ScheduleTask[] = [
  { id: 'A', title: 'Design', kind: 'done', estimate: { a: 4 * W, m: 8 * W, b: 12 * W } },
  { id: 'B', title: 'Build', kind: 'doing', estimate: { a: 6 * W, m: 9 * W, b: 18 * W } },
  { id: 'C', title: 'Docs', kind: 'todo', estimate: { a: 5 * W, m: 6 * W, b: 7 * W } },
  { id: 'D', title: 'Integrate', kind: 'doing', estimate: { a: 10 * W, m: 12 * W, b: 20 * W } },
  { id: 'E', title: 'Ship', kind: 'todo', estimate: { a: 3 * W, m: 4 * W, b: 5 * W } }
];
const links = [
  { from: 'A', to: 'B' },
  { from: 'A', to: 'C' },
  { from: 'B', to: 'D' },
  { from: 'C', to: 'D' },
  { from: 'D', to: 'E' }
];

function fixture() {
  const result = computeSchedule(toPertTasks(tasks), links);
  if (!result.ok) throw new Error(`fixture must compute: ${JSON.stringify(result.error)}`);
  return result.value;
}

const schedule = fixture();
const base = { schedule, tasks, links, projectStart: PROJECT_START, k: 2 };

describe('unit conversions (days are canonical, weeks are display)', () => {
  test('a duration divides by 7; a variance divides by 49', () => {
    expect(durationInUnit(245, 'week')).toBe(35);
    expect(durationInUnit(56, 'day')).toBe(56);
    // variance is days², so it scales by 7² — dividing by 7 here is the classic mistake
    expect(varianceInUnit(424.6667, 'week')).toBeCloseTo(8.6667, 3);
    expect(varianceInUnit(424.6667, 'day')).toBe(424.6667);
    expect(varianceInUnit(0, 'week')).toBe(0);
  });

  test('formatDuration rounds to one decimal and drops a trailing .0', () => {
    expect(formatDuration(245, 'week')).toBe('35 w');
    expect(formatDuration(56, 'day')).toBe('56 d');
    expect(formatDuration(20.6075, 'day')).toBe('20.6 d');
    expect(formatDuration(41.215, 'day')).toBe('41.2 d');
  });
});

describe('toGanttRows', () => {
  test('one row per scheduled task, in the engine order', () => {
    const rows = toGanttRows(base);
    expect(rows.map((r) => r.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  test('progress follows the column kind, not a title', () => {
    const rows = toGanttRows(base);
    expect(rows.map((r) => r.progress)).toEqual([100, 50, 0, 50, 0]);
  });

  test('start = projectStart + ES days and end = projectStart + EF days, in WIB', () => {
    const rows = toGanttRows(base);
    const a = rows[0];
    // 2026-10-01 00:00 WIB is 2026-09-30 17:00 UTC; A's ES is 0 and EF is 56 days
    expect(a.start).toBe('2026-09-30T17:00:00.000Z');
    expect(a.end).toBe('2026-11-25T17:00:00.000Z');
    // C starts where A ends (ES 56) — a shared boundary must be the same instant, not a re-derivation
    const c = rows.find((r) => r.id === 'C')!;
    expect(c.start).toBe(a.end);
    expect(c.esDays).toBe(56);
    expect(c.efDays).toBe(98);
  });

  test('a fractional ES keeps its exact instant instead of rounding to a day', () => {
    // X drives Z by a hair: TE 14 d ties with Y, but the tie goes to the larger variance
    const fractional: ScheduleTask[] = [
      { id: 'X', title: 'X', kind: 'todo', estimate: { a: 7, m: 14, b: 21 } },
      { id: 'Y', title: 'Y', kind: 'todo', estimate: { a: 14, m: 14, b: 14 } },
      { id: 'Z', title: 'Z', kind: 'todo', estimate: { a: 28, m: 28, b: 28 } }
    ];
    const fl = [
      { from: 'X', to: 'Z' },
      { from: 'Y', to: 'Z' }
    ];
    const res = computeSchedule(toPertTasks(fractional), fl);
    if (!res.ok) throw new Error('must compute');
    const rows = toGanttRows({
      schedule: res.value,
      tasks: fractional,
      links: fl,
      projectStart: PROJECT_START,
      k: 2
    });
    // Z starts at day 14 exactly; the offset is applied as milliseconds, so no drift appears
    expect(rows.find((r) => r.id === 'Z')!.start).toBe('2026-10-14T17:00:00.000Z');
  });

  test('dependencies are the predecessors, and only the critical path sets criticalBar', () => {
    const rows = toGanttRows(base);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.A.dependencies).toEqual([]);
    expect(byId.B.dependencies).toEqual(['A']);
    expect(byId.D.dependencies.toSorted()).toEqual(['B', 'C']); // D joins B and C
    expect(byId.E.dependencies).toEqual(['D']);
    expect(rows.filter((r) => r.criticalBar).map((r) => r.id)).toEqual(['A', 'B', 'D', 'E']);
    expect(byId.C.criticalBar).toBe(false);
  });

  test('each bar carries its slack and its slack band (slack ∓ k·σ of its own path)', () => {
    const rows = toGanttRows(base);
    const c = rows.find((r) => r.id === 'C')!;
    expect(c.slackDays).toBeCloseTo(28, 6); // 4 weeks
    // C's path is A + C: variance (87.1111 + 5.4444) d² → σ 9.6206 d → 2σ 19.2412 d
    expect(c.slackBand.low).toBeCloseTo(28 - 2 * Math.sqrt(87.1111 + 5.4444), 3);
    expect(c.slackBand.high).toBeCloseTo(28 + 2 * Math.sqrt(87.1111 + 5.4444), 3);
    // a critical task sits at slack 0, so its low bound dips below zero
    const a = rows.find((r) => r.id === 'A')!;
    expect(a.slackDays).toBeCloseTo(0, 6);
    expect(a.slackBand.low).toBeLessThan(0);
    expect(a.slackBand.high).toBeGreaterThan(0);
  });

  test('sub-tasks are indented and sit immediately after their parent', () => {
    const withChild: ScheduleTask[] = [
      { id: 'P', title: 'Parent', kind: 'doing', estimate: { a: 7, m: 7, b: 7 } },
      { id: 'K', title: 'Child one', parentId: 'P', kind: 'todo', estimate: { a: 3, m: 3, b: 3 } },
      { id: 'Q', title: 'Other', kind: 'todo', estimate: { a: 5, m: 5, b: 5 } }
    ];
    const res = computeSchedule(toPertTasks(withChild), []);
    if (!res.ok) throw new Error('must compute');
    const rows = toGanttRows({
      schedule: res.value,
      tasks: withChild,
      links: [],
      projectStart: PROJECT_START,
      k: 2
    });
    expect(rows.map((r) => r.id)).toEqual(['P', 'K', 'Q']);
    expect(rows[0].name).toBe('Parent');
    expect(rows[0].isSubtask).toBe(false);
    expect(rows[1].name).toBe('↳ Child one');
    expect(rows[1].isSubtask).toBe(true);
  });

  test('a task that is not scheduled gets no row', () => {
    // only the estimated tasks are passed to the engine; an unestimated one simply is not there
    const rows = toGanttRows(base);
    expect(rows).toHaveLength(5);
  });

  test('ignores an unestimated task mixed into the input instead of crashing on it', () => {
    // The board's task list is the caller's to filter, but a mixed array must not blow up the view:
    // a task the engine never saw has no node, so it is skipped (and reported as unscheduled).
    const mixed: ScheduleTask[] = [
      ...tasks,
      { id: 'F', title: 'No estimate yet', kind: 'todo', estimate: null }
    ];
    const rows = toGanttRows({ ...base, tasks: mixed });
    expect(rows.map((r) => r.id)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(rows.some((r) => r.id === 'F')).toBe(false);
    expect(toNetworkRows({ ...base, tasks: mixed }).map((r) => r.id)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E'
    ]);
    expect(unscheduledTasks(mixed, schedule.order).map((t) => t.id)).toEqual(['F']);
  });

  test("honours k when building each bar's slack band", () => {
    const withK = toGanttRows({ ...base, k: 1 });
    const c = withK.find((r) => r.id === 'C')!;
    // k=1 is half the k=2 band on both sides
    expect(c.slackBand.low).toBeCloseTo(28 - Math.sqrt(92.5556), 3);
    expect(c.slackBand.high).toBeCloseTo(28 + Math.sqrt(92.5556), 3);
  });
});

describe('toNetworkRows', () => {
  test('echoes a/m/b and the computed columns for every scheduled task', () => {
    const rows = toNetworkRows(base);
    const c = rows.find((r) => r.id === 'C')!;
    expect(c.a).toBe(35);
    expect(c.m).toBe(42);
    expect(c.b).toBe(49);
    expect(c.te).toBeCloseTo(42, 6);
    expect(c.variance).toBeCloseTo(5.4444, 3);
    expect(c.sd).toBeCloseTo(Math.sqrt(5.4444), 3);
    expect(c.es).toBeCloseTo(56, 6);
    expect(c.ef).toBeCloseTo(98, 6);
    expect(c.ls).toBeCloseTo(84, 6);
    expect(c.lf).toBeCloseTo(126, 6);
    expect(c.slack).toBeCloseTo(28, 6);
    expect(c.critical).toBe(false);
    expect(c.onCriticalPath).toBe(false);
  });

  test('distinguishes zero slack from membership in the reported critical path', () => {
    // X and Y both finish at day 14; the schedule reports [X, Z] because X carries the variance, so
    // Y has zero slack yet is NOT on the reported path. PSI-120 must not conflate the two.
    const tie: ScheduleTask[] = [
      { id: 'X', title: 'X', kind: 'todo', estimate: { a: 7, m: 14, b: 21 } },
      { id: 'Y', title: 'Y', kind: 'todo', estimate: { a: 14, m: 14, b: 14 } },
      { id: 'Z', title: 'Z', kind: 'todo', estimate: { a: 28, m: 28, b: 28 } }
    ];
    const tieLinks = [
      { from: 'X', to: 'Z' },
      { from: 'Y', to: 'Z' }
    ];
    const res = computeSchedule(toPertTasks(tie), tieLinks);
    if (!res.ok) throw new Error('must compute');
    const rows = toNetworkRows({
      schedule: res.value,
      tasks: tie,
      links: tieLinks,
      projectStart: PROJECT_START,
      k: 2
    });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.Y.slack).toBeCloseTo(0, 6);
    expect(byId.Y.critical).toBe(true);
    expect(byId.Y.onCriticalPath).toBe(false);
    expect(byId.X.critical).toBe(true);
    expect(byId.X.onCriticalPath).toBe(true);
    expect(byId.Z.onCriticalPath).toBe(true);
  });

  test('marks the whole fixture path and gives C its slack band', () => {
    const rows = toNetworkRows(base);
    expect(rows.filter((r) => r.onCriticalPath).map((r) => r.id)).toEqual(['A', 'B', 'D', 'E']);
    const c = rows.find((r) => r.id === 'C')!;
    expect(c.slackBand.low).toBeCloseTo(28 - 2 * Math.sqrt(92.5556), 3);
  });
});

describe('orderTasksForView', () => {
  test('keeps the engine order but pulls sub-tasks up under their parent', () => {
    const order = ['P', 'Q', 'K']; // K's parent is P
    const list: ScheduleTask[] = [
      { id: 'P', title: 'P', kind: 'todo', estimate: { a: 1, m: 1, b: 1 } },
      { id: 'Q', title: 'Q', kind: 'todo', estimate: { a: 1, m: 1, b: 1 } },
      { id: 'K', title: 'K', parentId: 'P', kind: 'todo', estimate: { a: 1, m: 1, b: 1 } }
    ];
    expect(orderTasksForView(order, list).map((t) => t.id)).toEqual(['P', 'K', 'Q']);
  });

  test('is stable when a parent is absent from the order (unscheduled parent)', () => {
    const order = ['K'];
    const list: ScheduleTask[] = [
      { id: 'K', title: 'K', parentId: 'GONE', kind: 'todo', estimate: { a: 1, m: 1, b: 1 } }
    ];
    expect(orderTasksForView(order, list).map((t) => t.id)).toEqual(['K']);
  });

  test('emits a parent before a child even when the engine ordered the child first', () => {
    // The engine's topological order is free to place a sub-task before its parent; the view must not.
    const order = ['K', 'P', 'Q'];
    const list: ScheduleTask[] = [
      { id: 'P', title: 'P', kind: 'todo', estimate: { a: 1, m: 1, b: 1 } },
      { id: 'Q', title: 'Q', kind: 'todo', estimate: { a: 1, m: 1, b: 1 } },
      { id: 'K', title: 'K', parentId: 'P', kind: 'todo', estimate: { a: 1, m: 1, b: 1 } }
    ];
    expect(orderTasksForView(order, list).map((t) => t.id)).toEqual(['P', 'K', 'Q']);
  });
});

describe('unscheduledTasks', () => {
  test('returns the tasks the engine never saw, in input order', () => {
    const all: ScheduleTask[] = [
      ...tasks,
      { id: 'F', title: 'No estimate yet', kind: 'todo', estimate: null }
    ];
    // F has no estimate, so it is not passed to the engine; it is "unscheduled", not an error
    const got = unscheduledTasks(all, schedule.order);
    expect(got.map((t) => t.id)).toEqual(['F']);
  });

  test('is empty when every task is scheduled', () => {
    expect(unscheduledTasks(tasks, schedule.order)).toEqual([]);
  });
});
