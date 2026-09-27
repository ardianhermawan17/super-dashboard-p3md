import { describe, expect, test, mock } from 'bun:test';
import { builder } from '../testing/fake-supabase';

// Same stub the other agent tests use: `server-only` throws outside an RSC.
mock.module('server-only', () => ({}));

// One swappable stub for the user-scoped client. `clientCalls` records the Authorization
// header the adapter passes, which is the whole point: it must be the caller's JWT, never
// a service-role key.
type Row = Record<string, unknown>;
let rows: Row[] = [];
const clientCalls: { headers?: Record<string, string> }[] = [];
const auditRows: Row[] = [];

mock.module('@supabase/supabase-js', () => ({
  createClient: (_url: string, _key: string, opts?: { global?: { headers?: Record<string, string> } }) => {
    clientCalls.push({ headers: opts?.global?.headers });
    return {
      from: (table: string) =>
        table === 'agent_audit_log'
          ? {
              insert: (row: Row) => {
                auditRows.push(row);
                return Promise.resolve({ error: null });
              },
            }
          : builder(rows),
    };
  },
}));

const { registerAgentTools } = await import('./mcp');
const { agentTools } = await import('../registry');
const getBoard = agentTools.find((t) => t.name === 'get_board')!;

/** Captures what registerAgentTools registers so a tool callback can be invoked directly. */
function makeServer() {
  const registered: { name: string; handler: (args: unknown, ctx: unknown) => Promise<unknown> }[] = [];
  const server = {
    registerTool: (
      name: string,
      _meta: unknown,
      handler: (args: unknown, ctx: unknown) => Promise<unknown>,
    ) => {
      registered.push({ name, handler });
    },
  };
  // The adapter types against the SDK's McpServer; this stub carries only what it touches.
  registerAgentTools(server as never);
  return registered;
}

describe('MCP adapter', () => {
  test('registers every tool in the shared registry', () => {
    expect(makeServer().map((r) => r.name)).toEqual(agentTools.map((t) => t.name));
  });

  test('runs the tool as the calling user: JWT forwarded, result serialized', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-anon-key';

    rows = [{ id: '11111111-1111-1111-1111-111111111111', title: 'A task' }];
    clientCalls.length = 0;

    const tool = makeServer().find((r) => r.name === getBoard.name)!;
    const out = (await tool.handler(
      {},
      { http: { authInfo: { token: 'user-jwt', clientId: 'claude' } } },
    )) as { content: { type: string; text: string }[] };

    expect(clientCalls[0].headers?.Authorization).toBe('Bearer user-jwt');
    expect(clientCalls[0].headers?.Authorization).not.toContain('service_role');
    expect(out.content[0].type).toBe('text');
    expect(() => JSON.parse(out.content[0].text)).not.toThrow();
  });

  test('records the client id in the audit log', async () => {
    rows = [];
    auditRows.length = 0;

    const tool = makeServer().find((r) => r.name === getBoard.name)!;
    await tool.handler({}, { http: { authInfo: { token: 'user-jwt', clientId: 'claude' } } });

    expect(auditRows[0].client_id).toBe('claude');
    expect(auditRows[0].tool).toBe(getBoard.name);
  });
});
