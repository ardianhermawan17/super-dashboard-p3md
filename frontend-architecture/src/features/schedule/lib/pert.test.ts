// frontend-architecture/src/features/schedule/lib/pert.test.ts
// PSI-119 AC: "Pure TypeScript module with unit tests: TE = (a + 4m + b) / 6, variance =
// ((b − a) / 6)², σ = √variance per task; forward and backward pass giving ES, EF, LS, LF and
// slack (LS − ES) per node; critical path; path TE and σ as sums along the critical path; for a
// target duration (e.g. 38 weeks) returns z and probability; for an operator-chosen k (e.g. 2)
// returns the range TE − kσ … TE + kσ with slack shown as ± measurable time; cycle and
// missing-estimate inputs return typed errors, never throw; tests include the textbook 38-week
// example."
//
// The fixture and every expected number come from docs/agent-operations/phase-11-brief.md §3 and
// docs/frontend-architecture/features/cpm-evm.md → PSI-119. The engine works in calendar days
// (brief §2 D7: durations are stored in days, weeks = days ÷ 7 and are never stored), so the
// fixture is authored in weeks, fed in as days and asserted as days ÷ 7.

import { describe, expect, test } from 'bun:test';
import { computeSchedule, sigmaRange, slackBand, targetProbability } from './pert';
import { normalCdf } from './normal-cdf';

const W = 7; // one week, in days
// Tolerance: toBeCloseTo(x, 3) is the brief §5 · PSI-119 bound of 1e-3.
const weeks = (days: number) => days / W; // a duration: days → weeks
const weeks2 = (daysSquared: number) => daysSquared / (W * W); // a variance: days² → weeks²

/** The textbook fixture: A(4,8,12), B(6,9,18) after A, C(5,6,7) after A, D(10,12,20) after B and C, E(3,4,5) after D. */
const fixtureTasks = [
  { id: 'A', a: 4 * W, m: 8 * W, b: 12 * W },
  { id: 'B', a: 6 * W, m: 9 * W, b: 18 * W },
  { id: 'C', a: 5 * W, m: 6 * W, b: 7 * W },
  { id: 'D', a: 10 * W, m: 12 * W, b: 20 * W },
  { id: 'E', a: 3 * W, m: 4 * W, b: 5 * W }
];
const fixtureLinks = [
  { from: 'A', to: 'B' },
  { from: 'A', to: 'C' },
  { from: 'B', to: 'D' },
  { from: 'C', to: 'D' },
  { from: 'D', to: 'E' }
];

/** cpm-evm.md → PSI-119 table, in weeks. */
const expected = [
  { id: 'A', te: 8, variance: 1.778, es: 0, ef: 8, ls: 0, lf: 8, slack: 0, critical: true },
  { id: 'B', te: 10, variance: 4, es: 8, ef: 18, ls: 8, lf: 18, slack: 0, critical: true },
  { id: 'C', te: 6, variance: 0.111, es: 8, ef: 14, ls: 12, lf: 18, slack: 4, critical: false },
  { id: 'D', te: 13, variance: 2.778, es: 18, ef: 31, ls: 18, lf: 31, slack: 0, critical: true },
  { id: 'E', te: 4, variance: 0.111, es: 31, ef: 35, ls: 31, lf: 35, slack: 0, critical: true }
];

/** Narrow the ok/error union, failing the test with the error payload when it is not ok. */
function unwrap(result: ReturnType<typeof computeSchedule>) {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('computeSchedule · the 38-week textbook fixture', () => {
  test('per node: te, variance, sd, es, ef, ls, lf and slack match the design table', () => {
    const schedule = unwrap(computeSchedule(fixtureTasks, fixtureLinks));

    for (const want of expected) {
      const got = schedule.nodes[want.id];
      expect(got).toBeDefined();
      // te / es / ef / ls / lf / slack are in days; the table is in weeks
      expect(weeks(got.te)).toBeCloseTo(want.te, 3);
      expect(weeks2(got.variance)).toBeCloseTo(want.variance, 3);
      expect(weeks(got.es)).toBeCloseTo(want.es, 3);
      expect(weeks(got.ef)).toBeCloseTo(want.ef, 3);
      expect(weeks(got.ls)).toBeCloseTo(want.ls, 3);
      expect(weeks(got.lf)).toBeCloseTo(want.lf, 3);
      expect(weeks(got.slack)).toBeCloseTo(want.slack, 3);
      // σ = √variance is a duration, so it comes back in weeks via weeks(), not weeks2()
      expect(weeks(got.sd)).toBeCloseTo(Math.sqrt(want.variance), 3);
      expect(got.critical).toBe(want.critical);
    }
  });

  test('TE = (a + 4m + b) / 6 and variance = ((b − a) / 6)² per task', () => {
    const schedule = unwrap(computeSchedule(fixtureTasks, fixtureLinks));
    // A(4,8,12):    TE 8,  var 1.7778   ·  D(10,12,20): TE 13, var 2.7778
    expect(weeks(schedule.nodes.A.te)).toBeCloseTo(8, 3);
    expect(weeks2(schedule.nodes.A.variance)).toBeCloseTo(((12 - 4) / 6) ** 2, 3);
    expect(weeks(schedule.nodes.D.te)).toBeCloseTo((10 + 4 * 12 + 20) / 6, 3);
    expect(weeks2(schedule.nodes.D.variance)).toBeCloseTo(((20 - 10) / 6) ** 2, 3);
    // a = m = b collapses to a deterministic duration with no spread
    const single = unwrap(computeSchedule([{ id: 'A', a: 6 * W, m: 6 * W, b: 6 * W }], []));
    expect(weeks(single.nodes.A.te)).toBeCloseTo(6, 3);
    expect(single.nodes.A.variance).toBe(0);
  });

  test('project totals: TE 35, variance 8.667, σ 2.944, critical path A-B-D-E', () => {
    const schedule = unwrap(computeSchedule(fixtureTasks, fixtureLinks));
    expect(weeks(schedule.projectTe)).toBeCloseTo(35, 3);
    expect(weeks2(schedule.projectVariance)).toBeCloseTo(8.667, 3);
    expect(weeks(schedule.projectSd)).toBeCloseTo(2.944, 3);
    expect(schedule.criticalPath).toEqual(['A', 'B', 'D', 'E']);
    expect(schedule.order).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  test('pathVariance accumulates along the driving path, not along the critical path', () => {
    const schedule = unwrap(computeSchedule(fixtureTasks, fixtureLinks));
    // A drives B (EF 8 beats nothing) and B drives D (EF 18 beats C's 14), so D carries
    // A + B + D, which is the critical-path variance; C is not on that path.
    expect(weeks2(schedule.nodes.A.pathVariance)).toBeCloseTo(1.778, 3);
    expect(weeks2(schedule.nodes.B.pathVariance)).toBeCloseTo(1.778 + 4, 3);
    expect(weeks2(schedule.nodes.C.pathVariance)).toBeCloseTo(1.778 + 0.111, 3);
    expect(weeks2(schedule.nodes.D.pathVariance)).toBeCloseTo(8.556, 3);
    expect(weeks2(schedule.nodes.E.pathVariance)).toBeCloseTo(8.667, 3);
    expect(schedule.nodes.E.pathVariance).toBeCloseTo(schedule.projectVariance, 9);
  });

  test('target 38 weeks: z 1.019 and P ≈ 0.846', () => {
    const schedule = unwrap(computeSchedule(fixtureTasks, fixtureLinks));
    const { z, probability } = targetProbability(schedule, 38 * W);
    expect(z).toBeCloseTo(1.019, 3);
    expect(probability).toBeCloseTo(0.846, 3);
    // a target that is already met and one far out are the only saturating cases
    expect(targetProbability(schedule, 35 * W).probability).toBeCloseTo(0.5, 3);
    expect(targetProbability(schedule, 60 * W).probability).toBeGreaterThan(0.999999);
    expect(targetProbability(schedule, 10 * W).probability).toBeLessThan(1e-6);
  });

  test('k = 2 gives the 2σ range 29.11 … 40.89 weeks around TE', () => {
    const schedule = unwrap(computeSchedule(fixtureTasks, fixtureLinks));
    const range = sigmaRange(schedule, 2);
    expect(weeks(range.expected)).toBeCloseTo(35, 3);
    expect(weeks(range.low)).toBeCloseTo(29.112, 3);
    expect(weeks(range.high)).toBeCloseTo(40.888, 3);
    // k = 1 is one σ either side, and k = 0 collapses to the expected value
    expect(weeks(sigmaRange(schedule, 1).low)).toBeCloseTo(35 - 2.944, 3);
    expect(sigmaRange(schedule, 0)).toEqual({
      low: schedule.projectTe,
      expected: schedule.projectTe,
      high: schedule.projectTe
    });
  });

  test('slackBand gives each task its slack ∓ k·σ of its own path', () => {
    const schedule = unwrap(computeSchedule(fixtureTasks, fixtureLinks));
    // C: slack 4 weeks, pathVariance 1.8889 → σ 1.3744 → 4 ∓ 2.7487
    const c = slackBand(schedule.nodes.C, 2);
    expect(weeks(c.low)).toBeCloseTo(4 - 2 * Math.sqrt(1.8889), 3);
    expect(weeks(c.high)).toBeCloseTo(4 + 2 * Math.sqrt(1.8889), 3);
    // A critical task sits at slack 0, so its low bound dips below zero — the design's signal
    // that the task can still become critical at that confidence (cpm-evm.md → PSI-119).
    const a = slackBand(schedule.nodes.A, 2);
    expect(weeks(a.low)).toBeLessThan(0);
    expect(a.high).toBeGreaterThan(0);
  });
});

describe('computeSchedule · typed errors instead of throws', () => {
  const t = (id: string) => ({ id, a: 1 * W, m: 2 * W, b: 3 * W });

  test('a cycle returns { kind: cycle } with its ids, never a throw', () => {
    const result = computeSchedule(
      [t('A'), t('B'), t('C')],
      [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' }
      ]
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('cycle');
    expect(result.error.kind === 'cycle' && result.error.ids.toSorted()).toEqual(['A', 'B', 'C']);
  });

  test('a self-link is a one-node cycle', () => {
    const result = computeSchedule([t('A')], [{ from: 'A', to: 'A' }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('cycle');
  });

  test('a link to a task with no estimate returns { kind: missing-estimate }', () => {
    // The caller passes only the tasks it has a/m/b for; a linked id that is absent is exactly
    // the DB's "linked but unestimated" case (cpm-evm.md → PSI-119).
    const result = computeSchedule([t('A')], [{ from: 'A', to: 'UNESTIMATED' }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('missing-estimate');
    expect(result.error.kind === 'missing-estimate' && result.error.ids).toEqual(['UNESTIMATED']);
  });

  test('estimates that break 0 ≤ a ≤ m ≤ b return { kind: invalid-estimate }', () => {
    const bad = [
      { id: 'A', a: 3 * W, m: 2 * W, b: 1 * W }, // a > m > b
      { id: 'B', a: 1 * W, m: 3 * W, b: 2 * W }, // m > b
      { id: 'C', a: -1, m: 2 * W, b: 3 * W }, // negative
      { id: 'D', a: 1 * W, m: Number.NaN, b: 3 * W }, // NaN
      { id: 'E', a: 1 * W, m: 2 * W, b: Number.POSITIVE_INFINITY } // not finite
    ];
    for (const task of bad) {
      const result = computeSchedule([task], []);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.kind).toBe('invalid-estimate');
      expect(result.error.kind === 'invalid-estimate' && result.error.ids).toEqual([task.id]);
    }
  });

  test('errors are returned, never thrown', () => {
    expect(() => computeSchedule([t('A')], [{ from: 'A', to: 'A' }])).not.toThrow();
    expect(() => computeSchedule([{ id: 'A', a: 5 * W, m: 1 * W, b: 2 * W }], [])).not.toThrow();
    expect(() => computeSchedule([t('A')], [{ from: 'A', to: 'gone' }])).not.toThrow();
  });
});

describe('computeSchedule · edges', () => {
  test('an empty network is a valid schedule, not an error', () => {
    const schedule = unwrap(computeSchedule([], []));
    expect(schedule.nodes).toEqual({});
    expect(schedule.order).toEqual([]);
    expect(schedule.criticalPath).toEqual([]);
    expect(schedule.projectTe).toBe(0);
    expect(schedule.projectVariance).toBe(0);
    expect(schedule.projectSd).toBe(0);
  });

  test('a zero-duration milestone is critical and carries no spread', () => {
    const schedule = unwrap(computeSchedule([{ id: 'M', a: 0, m: 0, b: 0 }], []));
    expect(schedule.nodes.M.te).toBe(0);
    expect(schedule.nodes.M.variance).toBe(0);
    expect(schedule.nodes.M.slack).toBe(0);
    expect(schedule.nodes.M.critical).toBe(true);
    expect(schedule.criticalPath).toEqual(['M']);
  });

  test('zero σ: the target is either certainly met or certainly missed', () => {
    const schedule = unwrap(computeSchedule([{ id: 'A', a: 4 * W, m: 4 * W, b: 4 * W }], []));
    expect(schedule.projectSd).toBe(0);
    expect(targetProbability(schedule, 4 * W).probability).toBe(1);
    expect(targetProbability(schedule, 5 * W).probability).toBe(1);
    expect(targetProbability(schedule, 3 * W).probability).toBe(0);
  });

  test('two paths of equal length: the critical path carries the larger variance', () => {
    // X and Y both finish at day 14, but X is uncertain and Y is not; Z joins them.
    const schedule = unwrap(
      computeSchedule(
        [
          { id: 'X', a: 1 * W, m: 2 * W, b: 3 * W }, // TE 2 w, var 0.111 w²
          { id: 'Y', a: 2 * W, m: 2 * W, b: 2 * W }, // TE 2 w, var 0
          { id: 'Z', a: 4 * W, m: 4 * W, b: 4 * W }
        ],
        [
          { from: 'X', to: 'Z' },
          { from: 'Y', to: 'Z' }
        ]
      )
    );
    expect(weeks(schedule.projectTe)).toBeCloseTo(6, 3);
    expect(weeks2(schedule.projectVariance)).toBeCloseTo(((3 - 1) / 6) ** 2, 6);
    expect(schedule.criticalPath).toEqual(['X', 'Z']);
  });

  test('an estimated task with no links is scheduled on its own', () => {
    const schedule = unwrap(
      computeSchedule(
        [
          { id: 'A', a: 2 * W, m: 2 * W, b: 2 * W },
          { id: 'LONE', a: 3 * W, m: 3 * W, b: 3 * W }
        ],
        []
      )
    );
    expect(schedule.nodes.LONE.es).toBe(0);
    expect(weeks(schedule.nodes.LONE.ef)).toBeCloseTo(3, 3);
    // LONE is the longer of two unlinked chains, so it becomes the project end and is
    // critical; A floats against it (LF 21 d against TE 14 d → 7 d of slack).
    expect(weeks(schedule.nodes.LONE.lf)).toBeCloseTo(3, 3);
    expect(schedule.projectTe).toBe(schedule.nodes.LONE.ef);
    expect(schedule.nodes.LONE.critical).toBe(true);
    expect(schedule.nodes.A.critical).toBe(false);
    expect(weeks(schedule.nodes.A.slack)).toBeCloseTo(1, 3);
  });

  test('a fan-in picks the latest predecessor for ES and the earliest successor for LF', () => {
    const schedule = unwrap(
      computeSchedule(
        [
          { id: 'A', a: 5 * W, m: 5 * W, b: 5 * W },
          { id: 'B', a: 2 * W, m: 2 * W, b: 2 * W },
          { id: 'END', a: 1 * W, m: 1 * W, b: 1 * W }
        ],
        [
          { from: 'A', to: 'END' },
          { from: 'B', to: 'END' }
        ]
      )
    );
    // ES = max(EF of predecessors): A finishes at 5 w, B at 2 w → END starts at 5 w
    expect(weeks(schedule.nodes.END.es)).toBeCloseTo(5, 3);
    // LF = min(LS of successors): B may finish as late as END starts, so B has 3 w of slack
    expect(weeks(schedule.nodes.B.slack)).toBeCloseTo(3, 3);
    expect(schedule.nodes.A.critical).toBe(true);
    expect(schedule.nodes.B.critical).toBe(false);
  });

  test('leaves its inputs untouched', () => {
    const tasks = [{ id: 'A', a: 1 * W, m: 2 * W, b: 3 * W }];
    const links = [{ from: 'A', to: 'A' }];
    const tasksCopy = structuredClone(tasks);
    const linksCopy = structuredClone(links);
    computeSchedule(tasks, links);
    expect(tasks).toEqual(tasksCopy);
    expect(links).toEqual(linksCopy);
  });

  test('the engine reads no clock and no randomness', async () => {
    const source = await Bun.file(new URL('./pert.ts', import.meta.url)).text();
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bnew Date\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bMath\.random\b/);
  });
});

describe('normalCdf · Φ(z), no dependency', () => {
  test('matches the standard normal at known points', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1)).toBeCloseTo(0.8413447, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.9750021, 6);
    expect(normalCdf(2.5758)).toBeCloseTo(0.995, 5);
  });

  test('is symmetric and monotone', () => {
    expect(normalCdf(-1) + normalCdf(1)).toBeCloseTo(1, 7);
    expect(normalCdf(-3)).toBeLessThan(normalCdf(-2));
    expect(normalCdf(1)).toBeLessThan(normalCdf(2));
  });

  test('saturates at 0 and 1 without exceeding them', () => {
    expect(normalCdf(-40)).toBeGreaterThanOrEqual(0);
    expect(normalCdf(40)).toBeLessThanOrEqual(1);
    expect(normalCdf(-40)).toBeCloseTo(0, 9);
    expect(normalCdf(40)).toBeCloseTo(1, 9);
  });
});
