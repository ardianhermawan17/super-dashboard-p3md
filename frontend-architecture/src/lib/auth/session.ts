import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type Session = {
  userId: string;
  email: string | null;
  roles: string[];
  groups: string[];
  permissions: string[];
};

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return null;
  const c = data.claims as {
    sub: string;
    email?: string;
    app_roles?: string[];
    app_groups?: string[];
    app_permissions?: string[];
  };
  return {
    userId: c.sub,
    email: c.email ?? null,
    roles: c.app_roles ?? [],
    groups: c.app_groups ?? [],
    permissions: c.app_permissions ?? []
  };
});
