// frontend-architecture/src/features/schedule/lib/pert.ts
// PSI-119 · the CPM/PERT calculation engine.
//
// Contract (docs/frontend-architecture/features/cpm-evm.md → PSI-119, brief §2 D7 and §5):
//   · pure TypeScript — no React, no `Date`, no `Math.random`, no I/O;
//   · durations are calendar DAYS as plain numbers (weeks are a display concern, days ÷ 7);
//   · bad input returns a typed error, it never throws and never returns a partial schedule.
//
// The public shapes below are the ones PSI-120 (Schedule tab + Gantt) and PSI-121 (EVM) consume,
// so they are fixed by the design rather than chosen here.

import { normalCdf } from './normal-cdf';

export type PertTask = { id: string; a: number; m: number; b: number }; // optimistic / likely / pessimistic, DAYS
export type TaskLink = { from: string; to: string }; // finish-to-start: `to` cannot start before `from` ends

export type NodeResult = {
  id: string;
  te: number; // expected time (a + 4m + b) / 6
  variance: number; // ((b − a) / 6)², in days²
  sd: number; // √variance, a duration in days
  es: number; // early start, forward pass
  ef: number; // early finish = es + te
  ls: number; // late start, backward pass
  lf: number; // late finish = ls + te
  slack: number; // ls − es, in days
  critical: boolean; // |slack| < 1e-9
  pathVariance: number; // Σ variance along the driving path into and including this node, days²
};

export type Schedule = {
  nodes: Record<string, NodeResult>;
  order: string[]; // topological
  projectTe: number; // max EF
  criticalPath: string[]; // the driving path through the project end
  projectVariance: number; // Σ variance on the critical path; on a duration tie, the larger
  projectSd: number; // √projectVariance
};

export type ScheduleError =
  | { kind: 'cycle'; ids: string[] }
  | { kind: 'missing-estimate'; ids: string[] } // a link points at an id with no a/m/b
  | { kind: 'invalid-estimate'; ids: string[] }; // breaks 0 ≤ a ≤ m ≤ b, or is not finite

export type ScheduleResult = { ok: true; value: Schedule } | { ok: false; error: ScheduleError };

/** Below this, two floats are the same number for scheduling purposes (the design's |slack| < 1e-9). */
const EPSILON = 1e-9;

/**
 * Compute the PERT network.
 *
 * `tasks` must hold only the tasks that HAVE an estimate — those are the ones that can be
 * scheduled. A task with no estimate is left out by the caller ("unscheduled" in the UI, and not an
 * error per the design); if a link then points at one of those ids, that is the `missing-estimate`
 * error. A repeated id replaces the earlier entry, since the network is keyed by id.
 *
 * Check order when more than one thing is wrong: invalid-estimate → missing-estimate → cycle. Each
 * error lists its ids; the lists are sorted so the result is stable for the same input.
 */
export function computeSchedule(tasks: PertTask[], links: TaskLink[]): ScheduleResult {
  // 1 · estimates must make sense before any graph work is attempted
  const invalid: string[] = [];
  const byId = new Map<string, PertTask>();
  for (const task of tasks) {
    if (!isValidEstimate(task)) {
      invalid.push(task.id);
      continue;
    }
    byId.set(task.id, task);
  }
  if (invalid.length > 0) return { ok: false, error: { kind: 'invalid-estimate', ids: invalid } };

  // 2 · every link endpoint needs an estimate, and duplicates would double-count in-degrees
  const missing = new Set<string>();
  const edges = new Map<string, Set<string>>(); // from → its successors
  const predecessors = new Map<string, Set<string>>(); // to → its predecessors
  const inDegree = new Map<string, number>();
  for (const id of byId.keys()) {
    edges.set(id, new Set());
    predecessors.set(id, new Set());
    inDegree.set(id, 0);
  }
  for (const link of links) {
    if (!byId.has(link.from)) missing.add(link.from);
    if (!byId.has(link.to)) missing.add(link.to);
    if (missing.has(link.from) || missing.has(link.to)) continue;
    if (edges.get(link.from)!.has(link.to)) continue; // same link twice
    edges.get(link.from)!.add(link.to);
    predecessors.get(link.to)!.add(link.from);
    inDegree.set(link.to, inDegree.get(link.to)! + 1);
  }
  if (missing.size > 0) {
    return { ok: false, error: { kind: 'missing-estimate', ids: [...missing].toSorted() } };
  }

  // 3 · topological order. Ties are broken by input order so the output is reproducible.
  const inputOrder = [...byId.keys()];
  const done = new Set<string>();
  const order: string[] = [];
  while (order.length < inputOrder.length) {
    const next = inputOrder.find((id) => !done.has(id) && inDegree.get(id) === 0);
    if (next === undefined) break; // everything left is in, or downstream of, a cycle
    done.add(next);
    order.push(next);
    for (const successor of edges.get(next)!) inDegree.set(successor, inDegree.get(successor)! - 1);
  }
  if (order.length < inputOrder.length) {
    const stuck = inputOrder.filter((id) => !done.has(id));
    return { ok: false, error: { kind: 'cycle', ids: stuck.toSorted() } };
  }

  // 4 · forward pass: es = max(ef of predecessors), ef = es + te.
  // `drivers` is per-call: the driving predecessor per node, kept beside (not inside) NodeResult so
  // the public shape stays exactly the one the design fixes for PSI-120/121.
  const drivers = new Map<string, string | undefined>();
  // The driving predecessor is the one that produced that max; on a duration tie the more
  // uncertain path drives, which is how projectVariance ends up "ties → the larger".
  const nodes: Record<string, NodeResult> = {};
  for (const id of order) {
    const task = byId.get(id)!;
    const te = (task.a + 4 * task.m + task.b) / 6;
    const variance = ((task.b - task.a) / 6) ** 2;

    let es = 0;
    let pathVariance = variance;
    let driver: string | undefined;
    for (const from of predecessors.get(id)!) {
      const previous = nodes[from];
      if (
        driver === undefined ||
        previous.ef > nodes[driver].ef + EPSILON ||
        (Math.abs(previous.ef - nodes[driver].ef) <= EPSILON &&
          previous.pathVariance > nodes[driver].pathVariance)
      ) {
        driver = from;
      }
    }
    if (driver !== undefined) {
      es = nodes[driver].ef;
      pathVariance = nodes[driver].pathVariance + variance;
    }

    nodes[id] = {
      id,
      te,
      variance,
      sd: Math.sqrt(variance),
      es,
      ef: es + te,
      ls: 0, // filled by the backward pass
      lf: 0,
      slack: 0,
      critical: false,
      pathVariance
    };
    // remember the driver so the critical path can be walked back later
    drivers.set(id, driver);
  }

  // 5 · project totals, then the backward pass: lf = min(ls of successors), or projectTe for an
  // end node (which floats against the project end and is therefore itself critical).
  const projectTe = order.reduce((max, id) => Math.max(max, nodes[id].ef), 0);
  for (const id of order.toReversed()) {
    const successors = edges.get(id)!;
    let lf = projectTe;
    if (successors.size > 0) {
      lf = Number.POSITIVE_INFINITY;
      for (const to of successors) lf = Math.min(lf, nodes[to].ls);
    }
    const node = nodes[id];
    node.lf = lf;
    node.ls = lf - node.te;
    node.slack = node.ls - node.es;
    node.critical = Math.abs(node.slack) < EPSILON;
  }

  // 6 · the critical path is the driving chain into the project end
  const end = order.reduce<string | undefined>((best, id) => {
    if (best === undefined) return id;
    if (nodes[id].ef > nodes[best].ef + EPSILON) return id;
    if (
      Math.abs(nodes[id].ef - nodes[best].ef) <= EPSILON &&
      nodes[id].pathVariance > nodes[best].pathVariance
    )
      return id;
    return best;
  }, undefined);

  const criticalPath: string[] = [];
  for (let id = end; id !== undefined; id = drivers.get(id)) criticalPath.unshift(id);

  const projectVariance = end === undefined ? 0 : nodes[end].pathVariance;

  return {
    ok: true,
    value: {
      nodes,
      order,
      projectTe,
      criticalPath,
      projectVariance,
      projectSd: Math.sqrt(projectVariance)
    }
  };
}

/** Chance of finishing by `targetDays`: z = (target − TE) / σ, P = Φ(z). */
export function targetProbability(
  s: Schedule,
  targetDays: number
): { z: number; probability: number } {
  // No spread means a certain answer: met if the target is not earlier than TE, otherwise missed.
  // z is reported as 0 because there is no distribution to standardise against.
  if (s.projectSd === 0) {
    return { z: 0, probability: targetDays >= s.projectTe ? 1 : 0 };
  }
  const z = (targetDays - s.projectTe) / s.projectSd;
  return { z, probability: normalCdf(z) };
}

/** The project range TE ∓ k·σ — the operator's "−2σ optimistic, 0 expected, +2σ pessimistic". */
export function sigmaRange(
  s: Schedule,
  k: number
): { low: number; expected: number; high: number } {
  return {
    low: s.projectTe - k * s.projectSd,
    expected: s.projectTe,
    high: s.projectTe + k * s.projectSd
  };
}

/**
 * A task's slack with its uncertainty: slack ∓ k·σ of that task's own driving path. A low bound
 * below zero means the task can still become critical at that confidence.
 */
export function slackBand(n: NodeResult, k: number): { low: number; high: number } {
  const spread = k * Math.sqrt(n.pathVariance);
  return { low: n.slack - spread, high: n.slack + spread };
}

/** 0 ≤ a ≤ m ≤ b, all finite. Anything else is a typed `invalid-estimate` error. */
function isValidEstimate(task: PertTask): boolean {
  const { a, m, b } = task;
  if (!Number.isFinite(a) || !Number.isFinite(m) || !Number.isFinite(b)) return false;
  return a >= 0 && a <= m && m <= b;
}
