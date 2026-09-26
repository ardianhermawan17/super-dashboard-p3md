// supabase/functions/_shared/internal.ts
// Guard internal endpoints called by pg_net (internal_post) and pg_cron.
// Spec: docs/backend-architecture/edge-functions.md § "Shared modules"

export function assertInternal(req: Request): void {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  const secret = Deno.env.get('INTERNAL_FN_SECRET') ?? 'local-dev-internal-secret';

  if (!token || token !== secret) {
    throw new Response(JSON.stringify({ error: 'unauthorized: invalid internal secret' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
