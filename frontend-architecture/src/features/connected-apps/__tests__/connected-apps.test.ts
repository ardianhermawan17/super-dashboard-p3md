import { describe, expect, it } from 'bun:test';
import { formatGrantDate, formatGrantRelative, formatGrantScopes } from '../lib/format';
import type { ConnectedAppGrant } from '../types';

describe('formatGrantScopes', () => {
  it('maps standard OAuth 2.1 scopes to readable badges and descriptions', () => {
    const formatted = formatGrantScopes(['openid', 'profile', 'email', 'offline_access']);
    expect(formatted).toEqual([
      {
        scope: 'openid',
        label: 'OpenID Identity',
        description: 'Verify your P3MD identity and account identifier',
      },
      {
        scope: 'profile',
        label: 'Profile Information',
        description: 'Read your display name and avatar',
      },
      {
        scope: 'email',
        label: 'Email Address',
        description: 'Read your account email address',
      },
      {
        scope: 'offline_access',
        label: 'Offline Access',
        description: 'Maintain persistent access via refresh tokens',
      },
    ]);
  });

  it('handles custom or unfamiliar scopes gracefully', () => {
    const formatted = formatGrantScopes(['custom.read', 'finance.manage']);
    expect(formatted).toEqual([
      {
        scope: 'custom.read',
        label: 'custom.read',
        description: 'Permission to access custom.read',
      },
      {
        scope: 'finance.manage',
        label: 'finance.manage',
        description: 'Permission to access finance.manage',
      },
    ]);
  });

  it('handles empty scopes array', () => {
    expect(formatGrantScopes([])).toEqual([]);
  });
});

describe('formatGrantDate', () => {
  it('formats ISO timestamps to WIB (Asia/Jakarta) representation', () => {
    // 2026-09-28T12:00:00Z is 19:00 WIB
    const formatted = formatGrantDate('2026-09-28T12:00:00Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('19:00');
    expect(formatted).toContain('WIB');
  });

  it('returns raw string for invalid dates', () => {
    expect(formatGrantDate('not-a-date')).toBe('not-a-date');
  });
});

describe('formatGrantRelative', () => {
  const baseTime = new Date('2026-09-28T12:00:00Z');

  it('formats recent events as Just now', () => {
    expect(formatGrantRelative('2026-09-28T11:59:45Z', baseTime)).toBe('Just now');
  });

  it('formats minutes ago', () => {
    expect(formatGrantRelative('2026-09-28T11:45:00Z', baseTime)).toBe('15m ago');
  });

  it('formats hours ago', () => {
    expect(formatGrantRelative('2026-09-28T09:00:00Z', baseTime)).toBe('3h ago');
  });

  it('formats days ago', () => {
    expect(formatGrantRelative('2026-09-25T12:00:00Z', baseTime)).toBe('3d ago');
  });

  it('handles future or invalid timestamps gracefully', () => {
    expect(formatGrantRelative('2026-09-28T13:00:00Z', baseTime)).toBe('Just now');
    expect(formatGrantRelative('invalid-date', baseTime)).toBe('invalid-date');
  });
});

describe('ConnectedAppGrant data structure', () => {
  it('validates a complete connected app object', () => {
    const grant: ConnectedAppGrant = {
      client: {
        id: 'client-uuid-1234',
        name: 'Claude Desktop',
        uri: 'https://claude.ai',
        logo_uri: 'https://claude.ai/favicon.ico',
      },
      scopes: ['openid', 'profile', 'email'],
      granted_at: '2026-09-28T10:30:00Z',
    };

    expect(grant.client.name).toBe('Claude Desktop');
    expect(grant.scopes.length).toBe(3);
    expect(grant.client.id).toBe('client-uuid-1234');
  });
});
