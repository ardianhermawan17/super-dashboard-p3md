import type {
  AuthOAuthAuthorizationDetailsResponse,
  OAuthAuthorizationClient,
  OAuthAuthorizationDetails,
} from '@supabase/supabase-js';

/**
 * Pure helpers for the OAuth 2.1 consent page (`/auth/consent`, PSI-074).
 *
 * Kept free of React and of the Supabase client so the resolution logic can be unit
 * tested without a browser or a live Auth server. The page component owns the side
 * effects (session check, approve/deny calls, redirects).
 *
 * Spec: docs/backend-architecture/auth-and-onboarding.md § "Supabase as the OAuth 2.1
 * server for agents (PSI-074)".
 */

export type FormattedScope = {
  scope: string;
  label: string;
  detail: string;
};

const SCOPE_LABELS: Record<string, { label: string; detail: string }> = {
  openid: { label: 'Verify your identity (OpenID)', detail: 'Confirm who you are via P3MD' },
  email: { label: 'View your email address', detail: 'Read your account email' },
  profile: { label: 'View basic profile info', detail: 'Read your display name and avatar' },
  offline_access: { label: 'Stay connected', detail: 'Refresh access without signing in again' },
};

/**
 * Split a space-separated OAuth scope string into display rows.
 * Unknown scopes are shown verbatim rather than dropped, so the user always sees the
 * full set of permissions being requested (never silently hide a scope).
 */
export function formatScopes(scope: string): FormattedScope[] {
  return scope
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => ({
      scope: s,
      label: SCOPE_LABELS[s]?.label ?? s,
      detail: SCOPE_LABELS[s]?.detail ?? `Permission to access ${s}`,
    }));
}

export type ConsentState =
  | { kind: 'auto_redirect'; redirectUrl: string }
  | {
      kind: 'consent_required';
      authorizationId: string;
      redirectUri: string;
      client: OAuthAuthorizationClient;
      user: OAuthAuthorizationDetails['user'];
      scopes: FormattedScope[];
    }
  | { kind: 'error'; error: string };

/**
 * Normalize the `getAuthorizationDetails` response into one of three UI states.
 *
 * The Supabase API returns either the full authorization details (consent needed) or a
 * ready redirect URL (the user already consented, per the auto-approve rule in the spec).
 * Type narrowing on `authorization_id` is the documented way to tell them apart.
 */
export function resolveConsentState(response: {
  data: AuthOAuthAuthorizationDetailsResponse['data'];
  error: { message: string } | null;
}): ConsentState {
  if (response.error || !response.data) {
    return {
      kind: 'error',
      error: response.error?.message ?? 'Could not load this authorization request.',
    };
  }

  const data = response.data;

  if ('authorization_id' in data && data.authorization_id) {
    return {
      kind: 'consent_required',
      authorizationId: data.authorization_id,
      redirectUri: data.redirect_uri,
      client: data.client,
      user: data.user,
      scopes: formatScopes(data.scope),
    };
  }

  if ('redirect_url' in data && data.redirect_url) {
    return { kind: 'auto_redirect', redirectUrl: data.redirect_url };
  }

  return { kind: 'error', error: 'This authorization request has no usable details.' };
}

/**
 * Build the sign-in URL that returns the user to this exact consent request after login.
 * Keeps the authorization_id so the flow resumes where it left off.
 */
export function signInUrlForConsent(authorizationId: string | null): string {
  const target = authorizationId
    ? `/auth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
    : '/auth/consent';
  return `/auth/sign-in?next=${encodeURIComponent(target)}`;
}
