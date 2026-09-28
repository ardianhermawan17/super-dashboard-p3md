import { describe, expect, it } from 'bun:test';

// Test the core consent resolution logic and scope mapping helpers.
import { formatScopes, resolveConsentState } from '../consent-lib';

describe('formatScopes', () => {
  it('maps standard OpenID scopes to human-readable labels', () => {
    const scopes = formatScopes('openid email profile');
    expect(scopes).toEqual([
      { scope: 'openid', label: 'Verify your identity (OpenID)', detail: 'Confirm who you are via P3MD' },
      { scope: 'email', label: 'View your email address', detail: 'Read your account email' },
      { scope: 'profile', label: 'View basic profile info', detail: 'Read your display name and avatar' },
    ]);
  });

  it('handles custom/unknown scopes gracefully', () => {
    const scopes = formatScopes('custom.read custom.write');
    expect(scopes).toEqual([
      { scope: 'custom.read', label: 'custom.read', detail: 'Permission to access custom.read' },
      { scope: 'custom.write', label: 'custom.write', detail: 'Permission to access custom.write' },
    ]);
  });

  it('handles empty or whitespace scopes', () => {
    expect(formatScopes('')).toEqual([]);
    expect(formatScopes('   ')).toEqual([]);
  });
});

describe('resolveConsentState', () => {
  it('identifies auto-redirect response (already consented)', () => {
    const response = {
      data: { redirect_url: 'https://client.test/callback?code=123' },
      error: null,
    };
    const state = resolveConsentState(response);
    expect(state.kind).toBe('auto_redirect');
    if (state.kind === 'auto_redirect') {
      expect(state.redirectUrl).toBe('https://client.test/callback?code=123');
    }
  });

  it('identifies consent required response', () => {
    const response = {
      data: {
        authorization_id: 'auth-123',
        redirect_uri: 'https://client.test/callback',
        client: {
          id: 'client-1',
          name: 'Claude Desktop',
          uri: 'https://claude.ai',
          logo_uri: 'https://claude.ai/logo.png',
        },
        user: { id: 'user-1', email: 'user@p3md.test' },
        scope: 'openid email profile',
      },
      error: null,
    };
    const state = resolveConsentState(response);
    expect(state.kind).toBe('consent_required');
    if (state.kind === 'consent_required') {
      expect(state.client.name).toBe('Claude Desktop');
      expect(state.user.email).toBe('user@p3md.test');
      expect(state.scopes.length).toBe(3);
    }
  });

  it('identifies error response', () => {
    const response = {
      data: null,
      error: { message: 'Authorization request expired or invalid', status: 400 },
    };
    const state = resolveConsentState(response);
    expect(state.kind).toBe('error');
    if (state.kind === 'error') {
      expect(state.error).toBe('Authorization request expired or invalid');
    }
  });
});
