/**
 * Agent tool contract.
 *
 * Types and the `defineTool` helper only — this module must never import a tool or the
 * registry. Tools import from here; `registry.ts` imports the tools. Anything else creates
 * a registry ↔ tool cycle where `defineTool` is undefined at module-load time.
 *
 * Spec: docs/backend-architecture/agent-layer-mcp.md
 */
import type { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

/** Everything a tool is allowed to know about its caller. */
export type AgentCtx = {
  /**
   * Client scoped to the calling user's JWT. RLS applies, so a tool cannot read a row the
   * caller could not read themselves. Never construct one with a service-role key here.
   */
  db: SupabaseClient<Database>;
  /** OAuth client id, or `in-app` for the assistant in the dashboard. Recorded in the audit log. */
  clientId: string;
};

export type AgentTool<I extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  /** Written for the model: when to call it, what it returns, and its caps. */
  description: string;
  input: I;
  run: (input: z.infer<I>, ctx: AgentCtx) => Promise<unknown>;
};

export const defineTool = <I extends z.ZodType>(tool: AgentTool<I>) => tool;