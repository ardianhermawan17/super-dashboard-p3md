import type { FormattedAppScope } from '../types';

/**
 * Known OAuth 2.1 scopes mapping to human-friendly labels and descriptions.
 * Any custom or unfamiliar scope falls back gracefully to formatted strings.
 */
const KNOWN_SCOPES: Record<string, { label: string; description: string }> = {
  openid: {
    label: 'OpenID Identity',
    description: 'Verify your P3MD identity and account identifier',
  },
  profile: {
    label: 'Profile Information',
    description: 'Read your display name and avatar',
  },
  email: {
    label: 'Email Address',
    description: 'Read your account email address',
  },
  phone: {
    label: 'Phone Number',
    description: 'Read your verified phone number',
  },
  offline_access: {
    label: 'Offline Access',
    description: 'Maintain persistent access via refresh tokens',
  },
};

/**
 * Format an array of raw OAuth scope strings into user-friendly badges.
 */
export function formatGrantScopes(scopes: string[]): FormattedAppScope[] {
  return scopes.map((scope) => {
    const clean = scope.trim();
    const known = KNOWN_SCOPES[clean];
    if (known) {
      return {
        scope: clean,
        label: known.label,
        description: known.description,
      };
    }
    return {
      scope: clean,
      label: clean,
      description: `Permission to access ${clean}`,
    };
  });
}

/**
 * Format an ISO date string to a localized WIB (Asia/Jakarta) date string.
 * Example: "28 Sep 2026, 19:49 WIB"
 */
export function formatGrantDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;

    const formatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);

    return `${formatted} WIB`;
  } catch {
    return isoDate;
  }
}

/**
 * Format an ISO date to a friendly relative timestamp (e.g. "Just now", "5m ago", "2d ago").
 */
export function formatGrantRelative(isoDate: string, now: Date = new Date()): string {
  try {
    const date = new Date(isoDate);
    if (isNaN(date.getTime())) return isoDate;

    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';

    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'Just now';

    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo ago`;

    return `${Math.floor(diffMonths / 12)}y ago`;
  } catch {
    return isoDate;
  }
}
