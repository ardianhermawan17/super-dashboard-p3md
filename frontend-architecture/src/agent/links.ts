/**
 * Deep links: every tool result carries one so a user (or the model) can jump from an
 * agent answer to the thing it is talking about.
 *
 * Routes must exist in src/app/dashboard — verified against the router, not guessed.
 */
/** Entity kinds that can appear in `activity_log.entity_type` (matches the column's check constraint). */
export type EntityType = 'task' | 'message' | 'event' | 'candidate';

const PATHS: Record<EntityType, string> = {
  task: '/dashboard/kanban',
  message: '/dashboard/mail',
  event: '/dashboard/calendar',
  candidate: '/dashboard/admin/users',
};

/**
 * Absolute-within-app link for an entity.
 *
 * The dashboard has no per-entity route yet, so the link targets the module and carries the
 * id as a query param — the module can highlight the row and it stays a valid URL today.
 * When real detail routes land, only this map changes.
 */
export function deepLink(entity: EntityType, id: string): string {
  return `${PATHS[entity]}?id=${encodeURIComponent(id)}`;
}

/** Link to a board by id (the board module reads `?board=` to preselect). */
export function boardLink(boardId: string): string {
  return `/dashboard/kanban?board=${encodeURIComponent(boardId)}`;
}