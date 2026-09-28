import { describe, expect, it, mock } from 'bun:test';

mock.module('server-only', () => ({}));

let mockSession: any = null;

mock.module('@/lib/auth/session', () => ({
  getSession: async () => mockSession,
}));

mock.module('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      insert: async () => ({ data: null, error: null }),
    }),
  }),
}));

const { POST } = await import('../route');

describe('/api/chat Route (PSI-076)', () => {
  it('rejects unauthenticated requests with 401', async () => {
    mockSession = null;

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toContain('Unauthorized');
  });

  it('rejects requests without agent.chat permission with 403', async () => {
    mockSession = {
      user: { id: 'usr-1', email: 'test@local.dev' },
      permissions: ['finance.read'],
    };

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Forbidden');
  });

  it('permits authorized users with agent.chat permission', async () => {
    mockSession = {
      user: { id: 'usr-1', email: 'test@local.dev' },
      permissions: ['agent.chat'],
    };

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            id: 'msg-1',
            role: 'user',
            parts: [{ type: 'text', text: 'What happened this week?' }],
          },
        ],
      }),
    });

    // Mock Anthropic or default provider fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response('event: message_start\ndata: {"type":"message_start","message":{"id":"msg-1"}}\n\n', {
        headers: { 'content-type': 'text/event-stream' },
      });

    try {
      const res = await POST(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
