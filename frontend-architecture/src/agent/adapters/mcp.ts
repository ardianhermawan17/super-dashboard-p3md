import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { ServerContext } from '@modelcontextprotocol/server';
import type { createMcpHandler } from 'mcp-handler';
import type { Database } from '@/lib/supabase/database.types';
import { agentTools } from '../registry';
import { runTool } from '../runtime';

type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0];

/**
 * Register the shared tool registry on an MCP server.
 *
 * Every call runs as the calling user: the client below carries their JWT, so RLS decides
 * what the tool can read. There is no service-role key on this path (C-04).
 */
export function registerAgentTools(server: McpServer) {
  for (const tool of agentTools) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.input },
      // Params annotated: `inputSchema` is typed as a generic `z.ZodType` on AgentTool, which
      // stops the overload from inferring the callback's own argument types.
      // mcp-handler 2.x: auth info lives on ctx.http, not the 1.x `extra.authInfo`.
      async (args: Record<string, unknown>, ctx: ServerContext) => {
        const auth = ctx.http?.authInfo;

        const db = createClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${auth?.token}` } },
            auth: { persistSession: false },
          },
        );

        const result = await runTool(tool, args, {
          db,
          clientId: auth?.clientId ?? 'unknown',
        });

        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      },
    );
  }
}
