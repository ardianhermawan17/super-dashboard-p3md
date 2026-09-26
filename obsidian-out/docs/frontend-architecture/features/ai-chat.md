# AI chat and connected apps

> **Scope:** the in-app assistant and the page where users manage external agents (MCP clients). Server side: [agent-layer-mcp.md](../../backend-architecture/agent-layer-mcp.md).
> Index: [frontend-architecture/](../README.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)

The template page already runs the real `useChat` lifecycle with a scripted conversation. Point it at our route:

```ts
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});
```

The model behind the chat is chosen server-side by `CHAT_MODEL` (Claude or a Hermes model, see [agent-layer-mcp.md](../../backend-architecture/agent-layer-mcp.md#llm-providers-claude-and-hermes-psi-098)); the UI never changes with it. The route and its tools are shared with the MCP server ([agent-layer-mcp.md](../../backend-architecture/agent-layer-mcp.md)). Render tool results as cards with the deep links the tools return.

## Connected apps

- **Connected apps:** list the user's OAuth grants (MCP clients such as Claude, ChatGPT or Hermes Agent) with a revoke button, using the Supabase Auth OAuth server APIs. Supabase auto-approves repeat authorizations, so revoking here is the user's only off switch.
