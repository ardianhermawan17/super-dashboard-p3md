// frontend-architecture/src/features/schedule/lib/link-guard.ts
// PSI-120 · the link editor's client-side guard.
//
// The design: "'Add predecessor' combobox (same board, excluding self and anything that would close a
// cycle, checked client-side too). The DB rejects cycles regardless."
//
// So this is a convenience, never the security boundary: M13's trigger plus advisory lock is what keeps
// the network acyclic, because two concurrent inserts can both pass a client-side check. Nothing here
// writes; it only decides what the editor may offer and why it declined.

import type { TaskLink } from './pert';

export type LinkBlockReason = 'self' | 'unknown-task' | 'duplicate' | 'cycle';

type Identified = { id: string };

/** Does `from` reach `to` by following links (from → to means `to` depends on `from`)? */
function reaches(links: TaskLink[], from: string, to: string): boolean {
  if (from === to) return true;
  const successors = new Map<string, string[]>();
  for (const link of links) {
    const list = successors.get(link.from) ?? [];
    list.push(link.to);
    successors.set(link.from, list);
  }
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of successors.get(current) ?? []) {
      if (next === to) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}

/**
 * Why `from → to` cannot be added, or null when it can.
 *
 * Order matters: self and unknown ends are reported as such, then an already-existing link as
 * `duplicate` (the shorter, more useful explanation), and only then a cycle.
 */
export function linkBlockReason(
  tasks: Identified[],
  links: TaskLink[],
  from: string,
  to: string
): LinkBlockReason | null {
  if (from === to) return 'self';
  const ids = new Set(tasks.map((task) => task.id));
  if (!ids.has(from) || !ids.has(to)) return 'unknown-task';
  if (links.some((link) => link.from === from && link.to === to)) return 'duplicate';
  // Adding `from → to` closes a loop when `to` can already reach `from`.
  if (reaches(links, to, from)) return 'cycle';
  return null;
}

/**
 * What the "Add predecessor" combobox may offer for `toId`: every other task that is neither an
 * existing predecessor nor a cycle-closer. Input order is preserved so the list is stable.
 */
export function predecessorCandidates(
  tasks: Identified[],
  links: TaskLink[],
  toId: string
): string[] {
  if (!tasks.some((task) => task.id === toId)) return [];
  return tasks
    .map((task) => task.id)
    .filter((id) => linkBlockReason(tasks, links, id, toId) === null);
}
