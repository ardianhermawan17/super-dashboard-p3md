import { describe, expect, it, mock } from 'bun:test';

// `server-only` throws unless imported from a React Server Component. The route and its
// auth module legitimately import it, so stub it here only for the test process — the
// guard stays in place for real builds.
mock.module('server-only', () => ({}));

// The MCP endpoint's auth gate (C-04: no secret key in this layer; the token is the user's JWT).
// AC: "/api/mcp answers 401 with a resource-metadata challenge without a token; with a valid
// Supabase JWT the tools list and run as that user."
//
// These tests exercise the route handler itself, not a copy of its logic: importing the route
// module is what proves the exported GET/POST are the authed wrapper.

const loadRoute = async () => {
  const mod = await import('../route');
  return mod;
};

describe('/api/mcp auth gate', () => {
  it('answers 401 with a resource-metadata challenge when no token is sent', async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request('https://app.test/api/mcp', { method: 'GET' }));

    expect(res.status).toBe(401);

    const challenge = res.headers.get('WWW-Authenticate') ?? '';
    expect(challenge.toLowerCase()).toContain('bearer');
    expect(challenge).toContain('resource_metadata=');
    expect(challenge).toContain('/.well-known/oauth-protected-resource');
  });

  it('rejects a malformed token with 401 rather than 500', async () => {
    const { GET } = await loadRoute();
    const res = await GET(
      new Request('https://app.test/api/mcp', {
        method: 'GET',
        headers: { authorization: 'Bearer not-a-jwt' },
      }),
    );

    expect(res.status).toBe(401);
  });

  it('does not leak the token or a stack trace in the 401 body', async () => {
    const { GET } = await loadRoute();
    const res = await GET(
      new Request('https://app.test/api/mcp', {
        method: 'GET',
        headers: { authorization: 'Bearer supersecret-token-value' },
      }),
    );

    const body = await res.text();
    expect(body).not.toContain('supersecret-token-value');
    expect(body).not.toContain('at Object.');
  });
});
