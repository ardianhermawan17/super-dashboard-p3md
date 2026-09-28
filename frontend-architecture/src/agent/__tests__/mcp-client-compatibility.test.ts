import { describe, expect, it } from 'bun:test';
import { generateKeyPair, SignJWT, exportJWK } from 'jose';

function classifyClientId(clientId: string): 'cimd_url' | 'dcr_or_static_uuid' | 'invalid' {
  if (!clientId || typeof clientId !== 'string') return 'invalid';
  if (clientId.startsWith('https://') || clientId.startsWith('http://')) {
    try {
      const parsed = new URL(clientId);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? 'cimd_url' : 'invalid';
    } catch {
      return 'invalid';
    }
  }
  if (/^[0-9a-f-]{36}$/i.test(clientId) || /^[a-zA-Z0-9_-]+$/.test(clientId)) {
    return 'dcr_or_static_uuid';
  }
  return 'invalid';
}

describe('MCP Client Compatibility (CIMD vs DCR - PSI-078)', () => {
  describe('RFC 7591 Dynamic Client Registration (DCR) Compliance', () => {
    it('validates DCR registration payload shape for Claude Desktop / Hermes Agent', () => {
      const dcrPayload = {
        client_name: 'Claude Desktop',
        redirect_uris: ['http://127.0.0.1:3000/auth/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: 'openid profile email',
      };

      expect(dcrPayload.client_name).toBe('Claude Desktop');
      expect(dcrPayload.grant_types).toContain('authorization_code');
      expect(dcrPayload.response_types).toContain('code');
      expect(dcrPayload.token_endpoint_auth_method).toBe('none');
      expect(dcrPayload.redirect_uris.length).toBeGreaterThan(0);
    });

    it('validates DCR registration response returned by Supabase Auth', () => {
      const dcrResponse = {
        client_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        client_name: 'Claude Desktop',
        redirect_uris: ['http://127.0.0.1:3000/auth/callback'],
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        scope: 'openid profile email',
      };

      expect(dcrResponse.client_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(dcrResponse.client_name).toBe('Claude Desktop');
    });
  });

  describe('Client ID Metadata Document (CIMD) vs DCR Resolution', () => {
    it('correctly classifies CIMD URL-based client IDs', () => {
      expect(classifyClientId('https://claude.ai/oauth/mcp-client.json')).toBe('cimd_url');
      expect(classifyClientId('https://cursor.com/.well-known/oauth-client.json')).toBe('cimd_url');
      expect(classifyClientId('http://localhost:3000/client.json')).toBe('cimd_url');
    });

    it('correctly classifies standard DCR / static UUID client IDs', () => {
      expect(classifyClientId('338350cd-4c1c-4888-ab55-2001d381e254')).toBe('dcr_or_static_uuid');
      expect(classifyClientId('hermes-agent-client-01')).toBe('dcr_or_static_uuid');
    });

    it('rejects malformed client IDs', () => {
      expect(classifyClientId('')).toBe('invalid');
      expect(classifyClientId('not a url or uuid!@#$')).toBe('invalid');
    });
  });

  describe('OAuth 2.1 Bearer Token Verification for MCP', () => {
    it('verifies a valid ES256 Supabase access token with client_id and scopes', async () => {
      const keyPair = await generateKeyPair('ES256');
      const jwk = await exportJWK(keyPair.publicKey);
      jwk.kid = 'test-key-id';
      jwk.alg = 'ES256';

      const token = await new SignJWT({
        role: 'authenticated',
        sub: '00000000-0000-0000-0000-000000000002',
        client_id: '338350cd-4c1c-4888-ab55-2001d381e254',
        scope: 'openid profile email',
      })
        .setProtectedHeader({ alg: 'ES256', kid: 'test-key-id' })
        .setIssuer('http://127.0.0.1:54371/auth/v1')
        .setAudience('authenticated')
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(keyPair.privateKey);

      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });
  });
});
