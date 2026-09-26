import { z } from 'zod';
import { defineTool } from '../define';
import { deepLink, type EntityType } from '../links';

const ENTITY_TYPES = ['task', 'message', 'event', 'candidate'] as const;

/**
 * Recent activity summarizer. The workhorse for "what is going on" questions: reads
 * `activity_log` (summaries only — the column's contract is "one human sentence, NO personal
 * data"), then deep-links each row. Newest first, capped at 100.
 */
export const getActivity = defineTool({
  name: 'get_activity',
  title: 'Recent activity',
  description:
    'What happened across boards, agenda and mail since a point in time. Call this first for ' +
    '"what is going on" questions. Newest first, max 100 items, each with a deep link. ' +
    'Summaries only, never raw message or document content.',
  input: z.object({
    since: z
      .string()
      .describe('ISO 8601 timestamp with offset, e.g. 2026-09-22T00:00:00+07:00'),
    entity: z
      .enum(ENTITY_TYPES)
      .optional()
      .describe('Narrow to one entity kind: task, message, event or candidate'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50)
      .describe('Max items to return'),
  }),
  async run({ since, entity, limit }, { db }) {
    let q = db
      .from('activity_log')
      .select('occurred_at, entity_type, entity_id, verb, summary')
      .gte('occurred_at', since)
      .order('occurred_at', { ascending: false })
      .limit(limit);
    if (entity) q = q.eq('entity_type', entity);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data.map((r) => ({
      occurred_at: r.occurred_at,
      kind: r.entity_type,
      verb: r.verb,
      summary: r.summary,
      link: deepLink(r.entity_type as EntityType, r.entity_id),
    }));
  },
});