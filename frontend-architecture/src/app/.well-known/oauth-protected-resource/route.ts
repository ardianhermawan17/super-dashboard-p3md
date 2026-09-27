import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler';

/**
 * RFC 9728 Protected Resource Metadata for `/api/mcp` (AC: the 401 challenge points here).
 *
 * A client that gets a 401 fetches this to discover which authorization server issues the
 * tokens it needs — Supabase Auth for this project.
 *
 * Spec: docs/backend-architecture/agent-layer-mcp.md
 */
const handler = protectedResourceHandler({
  authServerUrls: [`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1`],
});
const corsHandler = metadataCorsOptionsRequestHandler();

export { handler as GET, corsHandler as OPTIONS };
