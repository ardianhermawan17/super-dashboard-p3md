import { z } from 'zod';
import { defineTool } from '../define';
import { deepLink } from '../links';

const TIMEFRAME = z
  .union([
    z.literal('today'),
    z.literal('upcoming'),
    z.literal('past'),
    z.literal('all'),
  ])
  .default('upcoming');

/**
 * Agenda: events the caller can see, through `agent_agenda` (audience resolved to role/group
 * slugs, direct invitee count, source badge — never attendee identity beyond a count).
 */
export const getAgenda = defineTool({
  name: 'get_agenda',
  title: 'Agenda',
  description:
    'Events the caller can see, with role/group audience and a direct-invitee count. ' +
    'Use timeframe=upcoming for what is next, today for today (WIB). Never lists attendee ' +
    'identities, only a count. Capped at 50.',
  input: z.object({
    timeframe: TIMEFRAME.describe('today | upcoming | past | all'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(30)
      .describe('Max events to return'),
  }),
  async run({ timeframe, limit }, { db }) {
    const now = new Date().toISOString();
    const startOfTodayWIB = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }).slice(0, 10) + 'T00:00:00+07:00',
    ).toISOString();

    let q = db
      .from('agent_agenda')
      .select('id, title, starts_at, ends_at, all_day, location, rrule, source, audience_roles, audience_groups, direct_invitees')
      .order('starts_at', { ascending: true })
      .limit(limit);

    if (timeframe === 'today') {
      q = q.gte('starts_at', startOfTodayWIB).lt('starts_at', new Date(new Date(startOfTodayWIB).getTime() + 86_400_000).toISOString());
    } else if (timeframe === 'upcoming') {
      q = q.gte('starts_at', now);
    } else if (timeframe === 'past') {
      q = q.lt('starts_at', now);
    }
    // 'all' → no time filter.

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data
      .filter((r): r is typeof r & { id: string } => r.id !== null)
      .map((r) => ({
        id: r.id,
        title: r.title ?? '',
        starts_at: r.starts_at ?? '',
        ends_at: r.ends_at ?? '',
        all_day: r.all_day ?? false,
        location: r.location ?? undefined,
        rrule: r.rrule ?? undefined,
        source: r.source ?? 'app',
        audience_roles: r.audience_roles ?? [],
        audience_groups: r.audience_groups ?? [],
        direct_invitees: r.direct_invitees ?? 0,
        link: deepLink('event', r.id),
      }));
  },
});