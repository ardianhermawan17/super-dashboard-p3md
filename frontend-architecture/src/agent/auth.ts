import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { serverSupabaseUrl } from '@/lib/supabase/server-url';

export type AuthInfo = {
  token: string;
  clientId: string;
  scopes: string[];
  extra: { userId: string };
};

/**
 * Verify a Supabase access token (the user's JWT) for MCP bearer auth.
 *
 * The MCP client sends the user's Supabase JWT; we verify it against the project's
 * public JWKS. Returns undefined for anything we cannot trust, so the auth wrapper
 * answers 401 instead of letting an unverified request reach the tools.
 *
 * C-04: this reads only public key material. No secret key is used or needed here,
 * and every tool call downstream runs as the user, so RLS decides the rows.
 */
export async function verifySupabaseToken(
  _req: Request,
  bearer?: string,
): Promise<AuthInfo | undefined> {
  if (!bearer) return undefined;

  const supabaseUrl = serverSupabaseUrl();

  const issuer = `${supabaseUrl}/auth/v1`;

  try {
    const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    const { payload } = await jwtVerify(bearer, jwks, { issuer });

    if (payload.role !== 'authenticated') return undefined;
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) return undefined;

    return {
      token: bearer,
      clientId: typeof payload.client_id === 'string' ? payload.client_id : 'first-party',
      scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : [],
      extra: { userId: payload.sub },
    };
  } catch {
    return undefined;
  }
}