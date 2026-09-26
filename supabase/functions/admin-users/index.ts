import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/http.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: allowed } = await asUser.rpc('has_permission', { p_key: 'users.manage' });
  if (!allowed) return json({ error: 'forbidden' }, 403);

  const body = await req.json();
  switch (body.action) {
    case 'invite': {
      // 1. Store invites AS THE USER: RLS applies the escalation checks to role_ids / group_ids.
      const { error } = await asUser.from('user_invites').upsert(body.invites);
      if (error) return json({ error: error.message }, 400);
      // 2. Send invite emails (option A only; with option B users just sign in with Google).
      if (body.sendEmail) {
        const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:3000';
        for (const inv of body.invites) {
          await admin.auth.admin.inviteUserByEmail(inv.email, {
            redirectTo: `${siteUrl}/auth/confirm`,
            data: { full_name: inv.full_name },
          });
          await new Promise((r) => setTimeout(r, 250)); // stay under the Auth email rate limit
        }
      }
      return json({ ok: true, invited: body.invites.length });
    }
    case 'suspend':
    case 'reactivate': {
      const suspend = body.action === 'suspend';
      await admin.auth.admin.updateUserById(body.userId, { ban_duration: suspend ? '876000h' : 'none' });
      const { error } = await admin.from('profiles')
        .update({ status: suspend ? 'suspended' : 'active' }).eq('id', body.userId);
      if (error) return json({ error: error.message }, 409);   // e.g. last-admin guard
      return json({ ok: true });
    }
    default:
      return json({ error: 'unknown action' }, 400);
  }
});
