import 'server-only';
import type { AgentCtx, AgentTool } from './define';

/**
 * Validate input, run the tool, and record the call.
 *
 * The audit insert runs in `finally` so a failing tool is still logged — the trail matters
 * most when something went wrong. It is itself wrapped: an audit failure must never replace
 * or mask the tool's own result or error.
 */
export async function runTool(tool: AgentTool, rawArgs: unknown, ctx: AgentCtx) {
  const started = Date.now();
  let rows: number | null = null;
  let error: string | null = null;

  try {
    const input = tool.input.parse(rawArgs);
    const result = await tool.run(input, ctx);
    rows = Array.isArray(result) ? result.length : null;
    return result;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    // Runs as the user, so the insert policy allows logging only their own calls.
    const { error: auditError } = await ctx.db.from('agent_audit_log').insert({
      client_id: ctx.clientId,
      tool: tool.name,
      args: (rawArgs ?? {}) as never,
      rows_returned: rows,
      duration_ms: Date.now() - started,
      error,
    });
    if (auditError) {
      // Swallowed on purpose: losing one audit row is better than failing a successful call.
      console.error(`agent audit insert failed for tool ${tool.name}: ${auditError.message}`);
    }
  }
}