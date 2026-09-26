// supabase/functions/_shared/google.ts
// Service account token signer and Google API fetch helper.
// Spec: docs/backend-architecture/google-integration.md § "Service-account token helper"

import { importPKCS8, SignJWT } from 'npm:jose@5';

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

let cachedSa: ServiceAccount | null = null;

function getServiceAccount(): ServiceAccount {
  if (cachedSa) return cachedSa;
  const raw = Deno.env.get('GOOGLE_SA_KEY_B64');
  if (!raw) {
    throw new Error('missing GOOGLE_SA_KEY_B64 secret');
  }
  const decoded = atob(raw.trim());
  cachedSa = JSON.parse(decoded) as ServiceAccount;
  return cachedSa;
}

const tokenCache = new Map<string, { token: string; exp: number }>();

export const GOOGLE_SCOPES = {
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  calendarEvents: 'https://www.googleapis.com/auth/calendar.events',
  calendarFull: 'https://www.googleapis.com/auth/calendar',
  calendarReadonly: 'https://www.googleapis.com/auth/calendar.readonly',
};

export async function googleToken(scope: string): Promise<string> {
  const hit = tokenCache.get(scope);
  if (hit && hit.exp > Date.now() + 60_000) {
    return hit.token;
  }

  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(await importPKCS8(sa.private_key, 'RS256'));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`google oauth token error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const token = data.access_token as string;
  const expiresIn = (data.expires_in as number) ?? 3600;

  tokenCache.set(scope, { token, exp: Date.now() + expiresIn * 1000 });
  return token;
}

export async function gfetch(scope: string, url: string, init: RequestInit = {}): Promise<Response> {
  const token = await googleToken(scope);
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
