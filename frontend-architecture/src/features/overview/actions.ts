'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import type { DigestActionResult, DigestRow } from './types';

/**
 * Fetch the latest generated daily digest for the Overview dashboard (PSI-077).
 *
 * Gated by `digest.receive` permission.
 */
export async function getLatestDigestAction(digestId?: string): Promise<DigestActionResult> {
  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Unauthorized' };
  }

  if (!session.permissions.includes('digest.receive') && !session.permissions.includes('agent.audit')) {
    return { ok: false, error: 'Forbidden: missing digest.receive permission' };
  }

  const supabase = await createClient();

  let query = supabase.from('digests').select('*');

  if (digestId) {
    query = query.eq('id', digestId);
  } else {
    query = query.order('created_at', { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: (data as DigestRow) ?? null };
}
