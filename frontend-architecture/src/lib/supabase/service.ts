import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { serverSupabaseUrl } from './server-url';

export function createServiceClient() {
  const url = serverSupabaseUrl();
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase service URL or service-role secret key');
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
