import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerAgentTools } from '@/agent/adapters/mcp';
import { verifySupabaseToken } from '@/agent/auth';

/**
 * The external agent surface: the shared tool registry over MCP.
 *
 * `withMcpAuth` is the gate. Without a token it answers 401 with an RFC 9728
 * `WWW-Authenticate` challenge pointing at the protected-resource metadata below; with a
 * valid Supabase JWT the tools list and run as that user (C-04: no secret key here).
 *
 * Spec: docs/backend-architecture/agent-layer-mcp.md
 */
const handler = createMcpHandler((server) => registerAgentTools(server), {
  serverInfo: { name: 'p3md-social', version: '0.1.0' },
});

const authed = withMcpAuth(handler, verifySupabaseToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { authed as GET, authed as POST };

export const dynamic = 'force-dynamic';
