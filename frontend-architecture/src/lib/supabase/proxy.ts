import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Never redirect these to sign-in:
// - /api/mcp needs a real 401 so MCP clients start OAuth discovery
// - /api/calendar/feed and /api/push/dispatch carry their own tokens/secrets
// - PWA files must load for the service worker and install prompt
const PUBLIC_PREFIXES = [
  '/auth', '/api/mcp', '/api/calendar/feed', '/api/push/dispatch', '/.well-known',
  '/sw.js', '/manifest.webmanifest', '/icons/',
];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Keep this call directly after createServerClient: it refreshes an expiring session.
  const { data } = await supabase.auth.getClaims();

  const isPublic = PUBLIC_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return response;
}
