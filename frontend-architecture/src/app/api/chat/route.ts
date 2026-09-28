import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { model } from '@/agent/models';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { toAiSdkTools } from '@/agent/adapters/ai-sdk';

/**
 * Streaming in-app AI chat endpoint using shared tools (PSI-076).
 *
 * Spec reference: docs/backend-architecture/agent-layer-mcp.md § "In-app chat route (PSI-076)"
 * Guarded by permission `agent.chat`.
 * Tool executions are audited in `agent_audit_log` with `client_id: 'in-app'`.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized: please sign in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const hasChatPermission =
    session.permissions.includes('agent.chat') ||
    session.permissions.includes('agent.audit');

  if (!hasChatPermission) {
    return new Response(JSON.stringify({ error: 'Forbidden: missing agent.chat permission' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json();
  const messages: UIMessage[] = body.messages || [];

  const db = await createClient();
  const modelSpec = process.env.CHAT_MODEL ?? 'anthropic:claude-sonnet-5';

  const result = streamText({
    model: model(modelSpec) as any,
    system:
      'You are the P3MD executive AI assistant. Answer accurately from tool results only, cite deep links (e.g. /dashboard/boards/<id>, /dashboard/calendar, /dashboard/finance), and explicitly state when data is not found rather than inventing details. Format responses with clean markdown.',
    messages: await convertToModelMessages(messages),
    tools: toAiSdkTools({ db, clientId: 'in-app' }),
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
