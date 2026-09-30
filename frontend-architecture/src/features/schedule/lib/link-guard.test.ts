// frontend-architecture/src/features/schedule/lib/link-guard.test.ts
// PSI-120 · the link editor's client-side guard ("Add predecessor" must exclude self and anything that
// would close a cycle, checked client-side too).
//
// This is a convenience mirror, NOT the authority: M13's DB guard (advisory lock + trigger) is what
// actually keeps the network acyclic, because two concurrent inserts can each pass a client check. The
// wording here matches the design's, deliberately.

import { describe, expect, test } from 'bun:test';
import { linkBlockReason, predecessorCandidates } from './link-guard';

/** The guard only ever looks at ids: the sub-task tree and the network are independent concerns. */
type Identified = { id: string };
const t = (id: string): Identified => ({ id });

const tasks: Identified[] = [t('A'), t('B'), t('C'), t('D'), t('E')];
const diamond = [
  { from: 'A', to: 'B' },
  { from: 'A', to: 'C' },
  { from: 'B', to: 'D' },
  { from: 'C', to: 'D' },
  { from: 'D', to: 'E' }
];

describe('linkBlockReason', () => {
  test('null for a link that is fine', () => {
    expect(linkBlockReason(tasks, [{ from: 'A', to: 'B' }], 'B', 'C')).toBeNull();
    expect(linkBlockReason(tasks, [], 'A', 'B')).toBeNull();
    // a sub-task is linkable like any other task (the tree and the network are independent)
    const withChild = [...tasks, t('K')];
    expect(linkBlockReason(withChild, [], 'A', 'K')).toBeNull();
  });

  test('self', () => {
    expect(linkBlockReason(tasks, [], 'A', 'A')).toBe('self');
  });

  test('unknown-task when either end is not on the board', () => {
    expect(linkBlockReason(tasks, [], 'A', 'GONE')).toBe('unknown-task');
    expect(linkBlockReason(tasks, [], 'GONE', 'A')).toBe('unknown-task');
  });

  test('duplicate when that exact link already exists', () => {
    expect(linkBlockReason(tasks, diamond, 'A', 'B')).toBe('duplicate');
  });

  test('cycle when the target can already reach the source', () => {
    // A → B → C already, so C → A would close the loop
    const chain = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' }
    ];
    expect(linkBlockReason(tasks, chain, 'C', 'A')).toBe('cycle');
    // reversing an existing link is the shortest cycle
    expect(linkBlockReason(tasks, [{ from: 'A', to: 'B' }], 'B', 'A')).toBe('cycle');
    // the diamond: E is downstream of everything, so anything → E is fine, but nothing downstream
    // of A may precede A
    expect(linkBlockReason(tasks, diamond, 'E', 'A')).toBe('cycle');
    expect(linkBlockReason(tasks, diamond, 'D', 'A')).toBe('cycle');
    // the reverse direction along the same edge pair is legal: C → B adds no loop
    expect(linkBlockReason(tasks, diamond, 'C', 'B')).toBeNull();
  });

  test('terminates on an already-cyclic network instead of looping forever', () => {
    // The DB guard should prevent this, but the client must not hang if it ever sees one: the walk
    // marks visited nodes, so a loop in the data cannot become a loop in the program.
    const cyclic = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' }
    ];
    expect(linkBlockReason(tasks, cyclic, 'D', 'E')).toBeNull();
    expect(linkBlockReason(tasks, cyclic, 'A', 'B')).toBe('duplicate');
    // D is a sink in this network, so nothing downstream of it exists: every other task may precede it
    expect(predecessorCandidates(tasks, cyclic, 'D')).toEqual(['A', 'B', 'C', 'E']);
    // A sits in an A→B→C→A loop, so B and C already reach it and are excluded; D and E are unrelated
    // and may still precede it.
    expect(predecessorCandidates(tasks, cyclic, 'A')).toEqual(['D', 'E']);
  });

  test('duplicate is reported before cycle (the shorter explanation wins)', () => {
    expect(linkBlockReason(tasks, [{ from: 'A', to: 'B' }], 'A', 'B')).toBe('duplicate');
  });
});

describe('predecessorCandidates', () => {
  test('for the last task, everything upstream is offerable', () => {
    // E's only predecessor is D; nothing is downstream of E, so A, B and C are all legal
    expect(predecessorCandidates(tasks, diamond, 'E').toSorted()).toEqual(['A', 'B', 'C']);
  });

  test('for the first task, nothing is offerable — everything is downstream of it', () => {
    expect(predecessorCandidates(tasks, diamond, 'A')).toEqual([]);
  });

  test('excludes existing predecessors and cycle-closers, keeping input order', () => {
    // D already has B and C; E is downstream of D; A is upstream, so only A remains
    expect(predecessorCandidates(tasks, diamond, 'D')).toEqual(['A']);
    // C has A; D and E are downstream of C
    expect(predecessorCandidates(tasks, diamond, 'C')).toEqual(['B']);
  });

  test('never offers the task itself, and returns nothing for an unknown target', () => {
    expect(predecessorCandidates(tasks, diamond, 'B')).not.toContain('B');
    expect(predecessorCandidates(tasks, diamond, 'GONE')).toEqual([]);
  });

  test('on an empty network every other task is offerable', () => {
    expect(predecessorCandidates(tasks, [], 'C')).toEqual(['A', 'B', 'D', 'E']);
  });

  test('agrees with linkBlockReason: every candidate would really be accepted', () => {
    for (const toId of tasks.map((x) => x.id)) {
      for (const fromId of predecessorCandidates(tasks, diamond, toId)) {
        expect(linkBlockReason(tasks, diamond, fromId, toId)).toBeNull();
      }
    }
  });
});
