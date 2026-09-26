# Agent layer (MCP + in-app chat)

> **Scope:** the product's own AI surface: one read-only tool registry exposed to external agents through `/api/mcp` and to the in-app assistant through `/api/chat`, plus the LLM provider layer (Claude and Hermes models).
> OAuth for agents: [auth-and-onboarding.md](auth-and-onboarding.md#supabase-as-the-oauth-21-server-for-agents-psi-074) · Views: [m8-agent-layer.md](../database-architecture/m8-agent-layer.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

One tool registry, two consumers: external MCP clients through `/api/mcp`, and the in-app chat through `/api/chat`. Every tool call runs **as the calling user** (their JWT), so RLS decides what an agent sees. No secret key anywhere in this layer.

```
src/agent/
├── define.ts            # AgentTool / AgentCtx types + defineTool() (imports no tools)
├── registry.ts          # agentTools[]: the only file that imports every tool
├── runtime.ts           # runTool(): validate input → run → audit log
├── models.ts          # model(): Claude or Hermes by CHAT_MODEL spec
├── auth.ts              # verifySupabaseToken() for MCP bearer tokens (JWKS)
├── links.ts             # deepLink(entity, id)
├── tools/
│   ├── get-activity.ts      # main summarizer tool (activity_log)
│   ├── get-board.ts         # agent_board_status
│   ├── get-agenda.ts        # agent_agenda
│   ├── get-inbox.ts         # agent_inbox
│   └── search-documents.ts  # agent_documents: names, paths, links only
└── adapters/
    ├── mcp.ts           # registerTool loop for mcp-handler
    └── ai-sdk.ts        # tool() map for streamText
```

## Registry and runtime

```ts
// src/agent/define.ts: types + helper only. Tools import from here, never from registry.ts,
// otherwise registry ↔ tool becomes a circular import and defineTool is undefined at load time.
import type { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type AgentCtx = { db: SupabaseClient<Database>; clientId: string };

export type AgentTool<I extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;   // written for the model: when to call it, what it returns, its limits
  input: I;
  run: (input: z.infer<I>, ctx: AgentCtx) => Promise<unknown>;
};

export const defineTool = <I extends z.ZodType>(tool: AgentTool<I>) => tool;
```

```ts
// src/agent/registry.ts: the one list both adapters read.
import { getActivity } from './tools/get-activity';
import { getBoard } from './tools/get-board';
import { getAgenda } from './tools/get-agenda';
import { getInbox } from './tools/get-inbox';
import { searchDocuments } from './tools/search-documents';

export const agentTools = [getActivity, getBoard, getAgenda, getInbox, searchDocuments];
```

```ts
// src/agent/runtime.ts
import 'server-only';
import type { AgentCtx, AgentTool } from './define';

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
    // Runs as the user: the insert policy only allows logging your own calls.
    await ctx.db.from('agent_audit_log').insert({
      client_id: ctx.clientId, tool: tool.name, args: rawArgs as object,
      rows_returned: rows, duration_ms: Date.now() - started, error,
    });
  }
}
```

## A tool

```ts
// src/agent/tools/get-activity.ts
import { z } from 'zod';
import { defineTool } from '../define';
import { deepLink } from '../links';

export const getActivity = defineTool({
  name: 'get_activity',
  title: 'Recent activity',
  description:
    'What happened across boards, agenda and mail since a point in time. Call this first for ' +
    '"what is going on" questions. Newest first, max 100 items, each with a deep link. Summaries only.',
  input: z.object({
    since: z.iso.datetime({ offset: true }).describe('ISO 8601, e.g. 2026-09-22T00:00:00+07:00'),
    entity: z.enum(['task', 'message', 'event', 'candidate']).optional(),
    limit: z.number().int().min(1).max(100).default(50),
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
    return data.map((r) => ({ ...r, link: deepLink(r.entity_type, r.entity_id) }));
  },
});
```

**Tool rules:** read-only in v1; every list capped and paginated; timestamps ISO with offset; every item carries a deep link; read only `activity_log` and `agent_*` views, never raw tables; no email addresses, phone numbers, CV text or document content in any output (C-08, C-18).

## MCP route (mcp-handler 2.x)

```bash
bun add mcp-handler@^2 @modelcontextprotocol/server@^2 jose   # needs zod ^4.2 and Node 20+
```

```ts
// src/agent/auth.ts
import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/server';

const ISSUER = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`;
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));

export async function verifySupabaseToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;
  try {
    const { payload } = await jwtVerify(bearer, JWKS, { issuer: ISSUER });
    if (payload.role !== 'authenticated') return undefined;
    return {
      token: bearer,
      clientId: typeof payload.client_id === 'string' ? payload.client_id : 'first-party',
      scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : [],
      extra: { userId: payload.sub },
    };
  } catch {
    return undefined;
  }
}
```

```ts
// src/agent/adapters/mcp.ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { createMcpHandler } from 'mcp-handler';
import type { Database } from '@/lib/supabase/database.types';
import { agentTools } from '../registry';
import { runTool } from '../runtime';

type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0];

export function registerAgentTools(server: McpServer) {
  for (const tool of agentTools) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.input },
      async (args, ctx) => {
        const auth = ctx.http?.authInfo;
        const db = createClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: `Bearer ${auth?.token}` } }, auth: { persistSession: false } },
        );
        const result = await runTool(tool, args, { db, clientId: auth?.clientId ?? 'unknown' });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      },
    );
  }
}
```

```ts
// src/app/api/mcp/route.ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerAgentTools } from '@/agent/adapters/mcp';
import { verifySupabaseToken } from '@/agent/auth';

const handler = createMcpHandler((server) => registerAgentTools(server), {
  serverInfo: { name: 'p3md-social', version: '0.1.0' },
});

const authed = withMcpAuth(handler, verifySupabaseToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authed as GET, authed as POST };
```

```ts
// src/app/.well-known/oauth-protected-resource/route.ts
import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from 'mcp-handler';

const handler = protectedResourceHandler({
  authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
});
const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
```

## In-app chat route (PSI-076)

```ts
// src/agent/adapters/ai-sdk.ts
import 'server-only';
import { tool } from 'ai';
import { agentTools } from '../registry';
import type { AgentCtx } from '../define';
import { runTool } from '../runtime';

export const toAiSdkTools = (ctx: AgentCtx) =>
  Object.fromEntries(
    agentTools.map((t) => [
      t.name,
      tool({ description: t.description, inputSchema: t.input, execute: (input) => runTool(t, input, ctx) }),
    ]),
  );
```

```ts
// src/app/api/chat/route.ts
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { model } from '@/agent/models';
import { createClient } from '@/lib/supabase/server';
import { toAiSdkTools } from '@/agent/adapters/ai-sdk';

export async function POST(req: Request) {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  if (!data?.claims) return new Response('Unauthorized', { status: 401 });

  const { messages }: { messages: UIMessage[] } = await req.json();
  const result = streamText({
    model: model(process.env.CHAT_MODEL),            // Claude or Hermes, see below
    system: 'You are the P3MD assistant. Answer only from tool results, cite their deep links, and say when data is missing.',
    messages: await convertToModelMessages(messages),
    tools: toAiSdkTools({ db, clientId: 'in-app' }),
    stopWhen: stepCountIs(5),
  });
  return result.toUIMessageStreamResponse();
}
```

## LLM providers: Claude and Hermes (PSI-098)

The product never hard-codes one model vendor. Every model call goes through one adapter per runtime, and each use case picks its model with a `provider:model` spec in the environment, so Claude and Nous Research's Hermes models can be mixed.

| Use case | Runtime | Env var | Default | Notes |
|---|---|---|---|---|
| In-app assistant | Next.js (`/api/chat`, AI SDK) | `CHAT_MODEL` | `anthropic:claude-sonnet-5` | Needs reliable tool calling across the shared registry |
| Daily digest | Edge Function `daily-digest` | `DIGEST_MODEL` | `anthropic:claude-haiku-4-5-20251001` | Summaries only, no personal data |
| CV skill extraction | Edge Function `parse-cv` | `CV_MODEL` | `anthropic:claude-haiku-4-5-20251001` | Personal data: provider choice is a human decision (C-08, C-15) |

Hermes models are reached through any OpenAI-compatible endpoint (Nous Portal or OpenRouter): `HERMES_BASE_URL` + `HERMES_API_KEY`, spec `hermes:<model id>` (take the exact id from the provider's catalogue, for example a Hermes 4 model on OpenRouter).

**Opinion:** keep Claude as the default for the tool-calling chat and switch a use case to Hermes only after it passes the same evaluation (PSI-098): ten canned questions answered from tool results, correct deep links, no invented data. Digests are the cheapest place to trial Hermes first.

### Next.js adapter

```ts
// src/agent/models.ts
import 'server-only';
import { model } from '@/agent/models';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

const hermes = createOpenAICompatible({
  name: 'hermes',
  baseURL: process.env.HERMES_BASE_URL ?? '',   // Nous Portal or OpenRouter, OpenAI-compatible
  apiKey: process.env.HERMES_API_KEY,
});

/** spec = "anthropic:<model>" | "hermes:<model>" */
export function model(spec = process.env.CHAT_MODEL ?? 'anthropic:claude-sonnet-5'): LanguageModel {
  const [provider, ...rest] = spec.split(':');
  const id = rest.join(':');
  switch (provider) {
    case 'anthropic':
      return anthropic(id);
    case 'hermes':
      return hermes(id);
    default:
      throw new Error(`Unknown model provider "${provider}" in "${spec}"`);
  }
}
```

### Edge Function adapter

```ts
// supabase/functions/_shared/llm.ts
type Msg = { role: 'user' | 'assistant'; content: string };

/** One text completion for Claude or Hermes. spec = "anthropic:<model>" | "hermes:<model>" */
export async function complete(spec: string, system: string, messages: Msg[], maxTokens = 1500): Promise<string> {
  const [provider, ...rest] = spec.split(':');
  const model = rest.join(':');

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, system, messages, max_tokens: maxTokens }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    return data.content.filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  }

  if (provider === 'hermes') {
    const res = await fetch(`${Deno.env.get('HERMES_BASE_URL')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${Deno.env.get('HERMES_API_KEY')}` },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: maxTokens }),
    });
    if (!res.ok) throw new Error(`hermes ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  throw new Error(`Unknown model provider "${provider}"`);
}
```

**Rules for both adapters**
- Store the spec that produced an output (`digests.model` already exists for this).
- Structured output (CV skills) is always validated against a JSON schema before use, whatever the model.
- Never send personal data to a provider a human hasn't approved for it (C-08, C-15).
- Secrets: `ANTHROPIC_API_KEY`, `HERMES_API_KEY` live in Vercel server env and Edge Function secrets only (C-04).
