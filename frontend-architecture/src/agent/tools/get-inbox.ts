import { z } from 'zod';
import { defineTool } from '../define';
import { deepLink } from '../links';

const STATUSES = z.union([z.literal('sent'), z.literal('failed')]);

/**
 * Outbound mail log through `agent_inbox`: subject and a 280-character snippet only, never
 * the full body — recipients are role/group slugs, never individual addresses (C-08).
 */
export const getInbox = defineTool({
  name: 'get_inbox',
  title: 'Sent mail',
  description:
    'Outbound role/group mail that was sent or failed, newest first. Subject plus a short ' +
    'snippet, never the full body, and audience as role/group slugs rather than addresses. ' +
    'Capped at 50.',
  input: z.object({
    status: STATUSES.optional().describe('sent | failed; omit for both'),
    since: z
      .string()
      .optional()
      .describe('ISO 8601 timestamp with offset; only messages created at or after this'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('Max messages to return'),
  }),
  async run({ status, since, limit }, { db }) {
    let q = db
      .from('agent_inbox')
      .select('id, target, subject, snippet, status, sent_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) q = q.eq('status', status);
    if (since) q = q.gte('created_at', since);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data
      .filter((r): r is typeof r & { id: string } => r.id !== null)
      .map((r) => ({
        id: r.id,
        audience: r.target ?? '',
        subject: r.subject ?? '',
        snippet: r.snippet ?? '',
        status: r.status ?? '',
        sent_at: r.sent_at ?? '',
        created_at: r.created_at ?? '',
        link: deepLink('message', r.id),
      }));
  },
});