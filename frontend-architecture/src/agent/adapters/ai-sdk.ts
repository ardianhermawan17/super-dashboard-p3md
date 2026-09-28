import 'server-only';
import { tool } from 'ai';
import { agentTools } from '../registry';
import type { AgentCtx } from '../define';
import { runTool } from '../runtime';

/**
 * Convert our shared read-only agent tool registry into an AI SDK tools map (PSI-076).
 *
 * Each tool execution runs with the authenticated user's context (db + clientId: 'in-app'),
 * ensuring full RLS protection and audit logging in public.agent_audit_log.
 *
 * Spec reference: docs/backend-architecture/agent-layer-mcp.md § "In-app chat route (PSI-076)"
 */
export const toAiSdkTools = (ctx: AgentCtx): Record<string, any> =>
  Object.fromEntries(
    agentTools.map((t) => [
      t.name,
      tool({
        description: t.description,
        inputSchema: t.input as any,
        execute: (input: any) => runTool(t as any, input, ctx),
      }),
    ]),
  );
