import { complete } from '../_shared/llm.ts';

export interface DigestContextData {
  activities: Array<{
    occurred_at: string;
    actor_name?: string | null;
    action: string;
    entity_type: string;
    entity_name?: string | null;
    summary?: string | null;
    board_name?: string | null;
  }>;
  events: Array<{
    title: string;
    starts_at: string;
    ends_at: string;
    all_day: boolean;
    location?: string | null;
  }>;
  tasks: Array<{
    title: string;
    due_date?: string | null;
    column_title?: string | null;
    is_done?: boolean | null;
  }>;
}

export function buildDigestPrompt(data: DigestContextData): string {
  const { activities, events, tasks } = data;

  const activityLines =
    activities.length > 0
      ? activities
          .map((a) => {
            const board = a.board_name ? ` on board "${a.board_name}"` : '';
            const summary = a.summary || `${a.actor_name || 'A user'} ${a.action} ${a.entity_type} "${a.entity_name || 'item'}"`;
            return `- [${a.occurred_at}] ${summary}${board}`;
          })
          .join('\n')
      : 'No recorded activity in the last 24 hours.';

  const eventLines =
    events.length > 0
      ? events
          .map((e) => {
            const time = e.all_day ? 'All-day' : `${e.starts_at} - ${e.ends_at}`;
            const loc = e.location ? ` (${e.location})` : '';
            return `- ${time}: ${e.title}${loc}`;
          })
          .join('\n')
      : 'No scheduled events for today.';

  const taskLines =
    tasks.length > 0
      ? tasks
          .map((t) => {
            const due = t.due_date ? ` (Due: ${t.due_date})` : '';
            const col = t.column_title ? ` [${t.column_title}]` : '';
            return `- ${t.title}${col}${due}`;
          })
          .join('\n')
      : 'No pending or overdue tasks.';

  return `Here is the current operational data:

### Recent Activity (Last 24 Hours)
${activityLines}

### Today's Calendar Agenda
${eventLines}

### Pending & Overdue Tasks
${taskLines}

Please summarize this into a concise morning briefing for project managers. Highlight blockers first, followed by today's agenda and key progress.`;
}

export async function generateDailyDigestSummary(
  data: DigestContextData,
  modelSpec: string,
): Promise<string> {
  const systemPrompt =
    'You are the P3MD executive assistant generating the daily morning briefing. Summarize for project managers; put blockers and overdue tasks first; group neatly by Board Activity, Today\'s Agenda, and Action Items. Format in clean markdown. Do not invent any data not present in the logs.';

  const userPrompt = buildDigestPrompt(data);

  return await complete(modelSpec, systemPrompt, [
    { role: 'user', content: userPrompt },
  ]);
}
