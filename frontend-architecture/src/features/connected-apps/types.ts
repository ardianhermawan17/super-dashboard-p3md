/**
 * Types for OAuth 2.1 Connected Apps / Grants management (PSI-075).
 *
 * Spec: docs/frontend-architecture/features/ai-chat.md#connected-apps
 * and docs/backend-architecture/auth-and-onboarding.md § "Supabase as the OAuth 2.1 server for agents".
 */

export type OAuthClientInfo = {
  id: string;
  name: string;
  uri?: string;
  logo_uri?: string;
};

export type ConnectedAppGrant = {
  client: OAuthClientInfo;
  scopes: string[];
  granted_at: string;
};

export type FormattedAppScope = {
  scope: string;
  label: string;
  description: string;
};

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
