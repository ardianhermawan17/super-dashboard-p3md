/**
 * The one tool list both consumers read: the MCP adapter (`/api/mcp`) and the in-app chat
 * adapter (`/api/chat`).
 *
 * This is the only file that imports every tool. Tools import `defineTool` from `./define`,
 * never from here, which is what keeps the module graph acyclic.
 *
 * Spec: docs/backend-architecture/agent-layer-mcp.md
 */
import { getActivity } from './tools/get-activity';
import { getBoard } from './tools/get-board';
import { getAgenda } from './tools/get-agenda';
import { getInbox } from './tools/get-inbox';
import { searchDocuments } from './tools/search-documents';
import { getFinance } from './tools/get-finance';

export const agentTools = [
  getActivity,
  getBoard,
  getAgenda,
  getInbox,
  searchDocuments,
  getFinance
];

export type { AgentCtx, AgentTool } from './define';