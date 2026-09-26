# Supabase clients and session

> **Scope:** browser/server Supabase clients, the Next.js 16 session proxy, auth pages, session claims, permission guards, navigation.
> Access model: [m1-rbac.md](../database-architecture/m1-rbac.md) · Index: [frontend-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Clients and the session proxy

### Browser client

```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
```

### Server client

```ts
// src/lib/supabase/server.ts
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component: proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}
```

### Session proxy (Next.js 16)

```ts
// src/lib/supabase/proxy.ts
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
```

```ts
// src/proxy.ts
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### Auth pages

Install the Supabase UI Library blocks (shadcn registry) instead of hand-writing forms:

```bash
npx shadcn@latest add @supabase/password-based-auth-nextjs
npx shadcn@latest add @supabase/dropzone-nextjs        # phase 8, CV upload
```

The blocks import the template's own `@/components/ui/*` primitives. After adding them, point them at the client modules above (one client module per side, not two) and convert any `asChild` usage ([conventions-and-testing.md](conventions-and-testing.md)). If onboarding uses Google sign-in ([auth-and-onboarding.md](../backend-architecture/auth-and-onboarding.md)), add a "Continue with Google" button calling `supabase.auth.signInWithOAuth({ provider: 'google' })`.

## Session, permissions and navigation

The access-token hook ([m1-rbac.md → access-token hook](../database-architecture/m1-rbac.md#access-token-hook)) adds `app_roles`, `app_groups` and `app_permissions` to every JWT. The UI reads them from the claims; RLS never trusts them.

```ts
// src/lib/auth/session.ts
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
    sub: string; email?: string; app_roles?: string[]; app_groups?: string[]; app_permissions?: string[];
  };
  return {
    userId: c.sub,
    email: c.email ?? null,
    roles: c.app_roles ?? [],
    groups: c.app_groups ?? [],
    permissions: c.app_permissions ?? [],
  };
});
```

Guard admin pages and privileged Server Actions with `requirePermission()` ([below](#guarding-pages-and-actions)). Never check `session.roles.includes('admin')` (contract C-17).

Navigation items carry a `permission`; items without one are visible to every signed-in user:

```ts
export type NavItem = { title: string; url: string; icon?: string; permission?: string };

export const navItems: NavItem[] = [
  { title: 'Notifications', url: '/dashboard/notifications' },
  { title: 'Overview', url: '/dashboard/overview' },
  { title: 'Mail', url: '/dashboard/mail' },
  { title: 'Agenda', url: '/dashboard/calendar' },
  { title: 'Board', url: '/dashboard/kanban' },
  { title: 'Documents', url: '/dashboard/documents' },
  { title: 'Talent', url: '/dashboard/talent', permission: 'talent.read' },
  { title: 'AI Assistant', url: '/dashboard/ai-chat', permission: 'agent.chat' },
  { title: 'Users', url: '/dashboard/admin/users', permission: 'users.read' },
  { title: 'Groups', url: '/dashboard/admin/groups', permission: 'groups.manage' },
  { title: 'Roles', url: '/dashboard/admin/roles', permission: 'roles.manage' },
  { title: 'Permissions', url: '/dashboard/admin/permissions', permission: 'roles.manage' },
  { title: 'Integrations', url: '/dashboard/admin/integrations', permission: 'integrations.manage' },
];

export const visibleNav = (items: NavItem[], permissions: string[]) =>
  items.filter((i) => !i.permission || permissions.includes(i.permission));
```

Resolve the session once in the dashboard layout (server) and pass `permissions` to the sidebar and kbar. **Hiding a menu item is cosmetic; RLS is the real guard.** Claims lag behind admin changes until the next token refresh; data access does not.

## Guarding pages and actions

Claims drive the UI; the database decides.

```ts
// src/lib/auth/require.ts
import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { getSession } from './session';

export async function requirePermission(key: string) {
  const session = await getSession();
  if (!session) redirect('/auth/sign-in');
  if (!session.permissions.includes(key)) notFound();   // don't reveal admin pages exist
  return session;
}
```

Use it at the top of admin pages and Server Actions. Because claims refresh with the token, the UI can lag up to one token lifetime behind a change; the database never does.
