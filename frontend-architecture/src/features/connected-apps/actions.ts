'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import type { ActionResult, ConnectedAppGrant } from './types';

/**
 * List all active OAuth grants for the authenticated user.
 *
 * Supabase auto-approves repeat authorizations after the first consent,
 * so this list and the revoke action are the user's explicit control switch.
 *
 * Spec: docs/frontend-architecture/features/ai-chat.md#connected-apps
 */
export async function listConnectedAppsAction(): Promise<ActionResult<ConnectedAppGrant[]>> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Unauthorized — please sign in' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.oauth.listGrants();

  if (error) {
    return { ok: false, error: error.message };
  }

  const grants: ConnectedAppGrant[] = (data ?? []).map((grant) => ({
    client: {
      id: grant.client.id,
      name: grant.client.name,
      uri: grant.client.uri || undefined,
      logo_uri: grant.client.logo_uri || undefined,
    },
    scopes: grant.scopes || [],
    granted_at: grant.granted_at,
  }));

  return { ok: true, data: grants };
}

/**
 * Revoke an OAuth grant for a specific client application.
 *
 * Deletes active sessions for that client and invalidates its refresh tokens.
 * A revoked client gets 401 on its next MCP / API call.
 */
export async function revokeConnectedAppAction(clientId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Unauthorized — please sign in' };
  }

  if (!clientId || typeof clientId !== 'string') {
    return { ok: false, error: 'Missing or invalid client identifier' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/connected-apps');
  revalidatePath('/dashboard/settings/connected-apps');

  return { ok: true, data: undefined };
}
