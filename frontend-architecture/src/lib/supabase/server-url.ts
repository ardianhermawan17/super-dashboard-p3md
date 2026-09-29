// NOTE: intentionally no `import 'server-only'` here — this module is a pure
// function of env vars and is unit-tested directly. Server-only usage is
// enforced at the call sites (proxy.ts, server.ts, service.ts all import it).
/**
 * Server-side Supabase base URL.
 *
 * Browser and server live in DIFFERENT network namespaces when the frontend
 * runs in Docker: the browser reaches Supabase on the host via
 * NEXT_PUBLIC_SUPABASE_URL (e.g. http://127.0.0.1:54371), but code executing
 * inside the container can only reach the host's Supabase via
 * SUPABASE_URL (e.g. http://host.docker.internal:54371).
 *
 * Server-side clients (proxy, session, service) MUST use this host-reachable
 * URL; using NEXT_PUBLIC_* from inside the container points 127.0.0.1 at the
 * container itself, so the proxy middleware can't verify the session and
 * bounces every authenticated navigation back to /auth/sign-in.
 */
export function serverSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    'http://127.0.0.1:54321'
  );
}
