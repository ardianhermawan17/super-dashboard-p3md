// frontend-architecture/src/features/schedule/types.ts
// PSI-120 · the schedule feature's shared types and input schemas.
//
// Durations are calendar DAYS throughout (brief §2 D7: "durations stored in calendar days; UI toggles
// days / weeks — not store weeks; weeks = days ÷ 7"). Weeks appear only at the display boundary,
// through lib/view-model.ts's unit helpers.
//
// The engine's own types live in lib/pert.ts; nothing here duplicates them.

import { z } from 'zod';
import type { NodeResult, Schedule } from './lib/pert';

/**
 * Column kind — frozen decision D8. The gate logic and the Gantt's `progress` key on this, never on a
 * column title ("Never match column titles like 'In Progress' in code").
 *
 * M12 (PSI-115) adds `board_columns.kind`; until it lands, readers map the legacy `is_done` flag
 * (`kanban/types.ts`), and this type is what M12 will supply.
 */
export const columnKindSchema = z.enum(['todo', 'doing', 'done']);
export type ColumnKind = z.infer<typeof columnKindSchema>;

/** Finished work is done; doing counts half (the standard EVM convention in D1). */
export const KIND_PROGRESS: Record<ColumnKind, 0 | 50 | 100> = { todo: 0, doing: 50, done: 100 };

const days = (label: string) =>
  z
    .number({ message: `${label} must be a number` })
    .nonnegative({ message: `${label} must be 0 or more` })
    .refine(Number.isFinite, { message: `${label} must be a finite number` });

/**
 * A three-point estimate, in calendar days. The refinement mirrors the engine's `invalid-estimate`
 * guard, so the form refuses the same input the engine would reject — one rule, two enforcement
 * points (the engine is still the authority; see lib/link-guard.ts for the same argument about cycles).
 */
export const estimateSchema = z
  .object({
    a: days('Optimistic'),
    m: days('Most likely'),
    b: days('Pessimistic')
  })
  .refine((e) => e.a <= e.m && e.m <= e.b, {
    message: 'Estimates must satisfy 0 ≤ a ≤ m ≤ b'
  });
export type Estimate = z.infer<typeof estimateSchema>;

/** A finish-to-start link: `to` cannot start until `from` ends. */
export const taskLinkInputSchema = z
  .object({
    from: z.string().min(1, { message: 'Pick a predecessor' }),
    to: z.string().min(1, { message: 'Pick a task' })
  })
  .refine((l) => l.from !== l.to, { message: 'A task cannot precede itself' });
export type TaskLinkInput = z.infer<typeof taskLinkInputSchema>;

/**
 * A task as the schedule views need it: the estimate (null while it is still unestimated — such a task
 * is "unscheduled", never an error) plus the presentation facts (title, sub-task parent, column kind).
 *
 * One all-or-none `estimate` rather than three nullable numbers, mirroring M13's
 * `est_optimistic`/`est_likely`/`est_pessimistic` plus its `num_nonnulls(...) in (0, 3)` check: the
 * DB's forbidden half-set state is unrepresentable here, so a form cannot leave a task half estimated.
 *
 * Callers build one array from the board and pass it to both the engine (via `toPertTasks`, which
 * drops the estimate-less ones) and the view-model, so the two cannot disagree about which tasks exist.
 */
export type ScheduleTask = {
  id: string;
  title: string;
  /** One level only (M12: sub-tasks are one level deep). */
  parentId?: string | null;
  kind: ColumnKind;
  estimate: Estimate | null;
};

/** One bar. Dates are UTC ISO strings; see lib/view-model.ts for the WIB derivation. */
export type GanttRow = {
  id: string;
  /** Sub-task titles are prefixed with "↳" (design: sub-tasks sit after their parent, indented). */
  name: string;
  start: string;
  end: string;
  progress: 0 | 50 | 100;
  /** Predecessor ids — `from` ends of the links that point at this task. */
  dependencies: string[];
  isSubtask: boolean;
  /** True only for tasks on the schedule's `criticalPath`. */
  criticalBar: boolean;
  esDays: number;
  efDays: number;
  slackDays: number;
  /** Slack with its uncertainty: slack ∓ k·σ of this task's own path, in days. */
  slackBand: { low: number; high: number };
};

/** One table row. Every duration is in days, every variance in days²; convert at the display edge. */
export type NetworkRow = {
  id: string;
  name: string;
  isSubtask: boolean;
  kind: ColumnKind;
  a: number;
  m: number;
  b: number;
  te: number;
  variance: number;
  sd: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  slack: number;
  slackBand: { low: number; high: number };
  /** Zero slack — the task is on *a* critical path. */
  critical: boolean;
  /** On the single path the schedule reports. Not the same as `critical`; see lib/view-model.ts. */
  onCriticalPath: boolean;
};

export type { NodeResult, Schedule };
