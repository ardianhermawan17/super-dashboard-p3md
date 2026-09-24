# Frontend architecture

> **Scope:** everything inside the Next.js app: routes, feature modules, Supabase clients, session and permissions, UI conventions.
> SQL, RLS, Edge Functions and MCP internals live in [backend-architecture.md](backend-architecture.md). Deep dives: [rbac-architecture.md](rbac-architecture.md), [pwa-notifications.md](pwa-notifications.md), [google-workspace-integration.md](google-workspace-integration.md). Gateway: [README_AI_AGENT.md](../README_AI_AGENT.md).

## Contents

1. [Decisions at a glance](#1-decisions-at-a-glance)
2. [Day 0: fork and strip the template](#2-day-0-fork-and-strip-the-template)
3. [Target folder structure](#3-target-folder-structure)
4. [Supabase clients and the session proxy](#4-supabase-clients-and-the-session-proxy)
5. [Session, permissions and navigation](#5-session-permissions-and-navigation)
6. [Data-layer pattern (copy this for every feature)](#6-data-layer-pattern-copy-this-for-every-feature)
7. [Feature modules](#7-feature-modules)
8. [Environment variables](#8-environment-variables)
9. [Conventions and guardrails](#9-conventions-and-guardrails)
10. [Testing](#10-testing)

---

## 1. Decisions at a glance

| Decision | Choice | Why |
|---|---|---|
| Base | Kiranism `next-shadcn-dashboard-starter` (MIT), **one-time fork** | Working tables, forms, kanban, chat and AI-chat plumbing; feature folders; ships `AGENTS.md`, `CLAUDE.md` and a Claude Code skill |
| Framework | Next.js 16 App Router, React 19 | Template default. `proxy.ts` replaces `middleware.ts` in Next.js 16 |
| UI | shadcn/ui on **Base UI** primitives, Tailwind CSS v4 | Template default. Composition uses the `render` prop, not `asChild` |
| Server state | TanStack Query SSR pattern: server `prefetchQuery` → `HydrationBoundary` → client `useSuspenseQuery` | Template default. One cache for server and client |
| Forms | TanStack Form + Zod | Template default. The same Zod schema validates again inside the Server Action |
| Auth | Supabase Auth through `@supabase/ssr`, session read with `getClaims()` | Clerk removed. Claims carry `app_roles`, `app_groups`, `app_permissions` for the UI |
| Access control | Users · Groups · Roles · Permissions; the app checks **permission keys only** | See [rbac-architecture.md](rbac-architecture.md). The database enforces; the UI only hides |
| Writes | Server Actions | One place for validation and auth; the browser never holds a privileged key |
| Reads | Supabase client injected into shared query functions | Same function runs on the server (prefetch) and in the browser (refetch) |
| Realtime | Supabase Realtime `postgres_changes` → invalidate the query | Simple and RLS-aware. Upgrade to Broadcast only if boards get busy |
| PWA | Installable, Web Push, start page = notification center; no offline data | See [pwa-notifications.md](pwa-notifications.md) |
| Documents | Google Drive metadata mirrored; files streamed through an RLS-checked Edge Function | See [google-workspace-integration.md](google-workspace-integration.md) |
| Package manager | bun | Template default |

**Upstream policy:** after the fork we never pull from upstream (the template author warns that updates cause merge conflicts). Cherry-pick by hand if something upstream is worth having.

---

## 2. Day 0: fork and strip the template

```bash
git clone --depth 1 https://github.com/Kiranism/next-shadcn-dashboard-starter.git p3md-social
cd p3md-social
rm -rf .git && git init -b main          # fresh history; LICENSE stays (MIT requires it)
bun install
cp env.example.txt .env.local

bun run cleanup --list                   # see what the cleanup script can remove
bun run cleanup clerk                    # removes Clerk + organizations + billing
bun run cleanup --interactive            # drop demos we don't need (products, users, react-query demo, …)
bun run dev                              # must still boot
```

**Keep:** `kanban` (becomes our board), `chat` (its multi-panel layout becomes the role-mail inbox), `ai-chat` (real `useChat` lifecycle; we swap the scripted transport for a real route), `notifications` (becomes the notification center UI).

**Then add, each in the task that needs it:**

```bash
bun add @supabase/supabase-js @supabase/ssr                 # PSI-010
bun add fractional-indexing                                 # PSI-051
bun add rrule date-fns @date-fns/tz                         # PSI-041
bun add web-push && bun add -d @types/web-push              # PSI-023
bun add ai @ai-sdk/react @ai-sdk/anthropic                  # PSI-076
bun add -d vitest @playwright/test                          # PSI-036
```

Record every added package in your history entry (`dependencies_added`, contract C-10).

---

## 3. Target folder structure

Only the parts we add or change are shown; everything else stays as the template ships it.

```
public/
├── sw.js                            # push-only service worker (PWA doc §5)
└── icons/                           # 192, 512, maskable 512, badge 72
src/
├── proxy.ts                         # Next.js 16 session refresh (was middleware.ts)
├── app/
│   ├── manifest.ts                  # PWA manifest → /manifest.webmanifest
│   ├── auth/
│   │   ├── sign-in/ · sign-up/      # Supabase UI password block (+ Google button, RBAC doc §10)
│   │   ├── confirm/route.ts         # email confirmation / invite / magic-link exchange
│   │   └── consent/page.tsx         # OAuth 2.1 consent screen for MCP clients
│   ├── dashboard/
│   │   ├── notifications/           # PWA start page: notification center
│   │   ├── overview/                # template analytics, later fed by agent views + digest
│   │   ├── mail/                    # role/group mail inbox + compose
│   │   ├── calendar/                # agenda (ported big-calendar, Google events badged)
│   │   ├── kanban/                  # template board, now on Supabase
│   │   ├── documents/               # Drive library + [id] viewer
│   │   ├── talent/                  # phase 8
│   │   ├── ai-chat/                 # template page, real /api/chat
│   │   ├── admin/
│   │   │   ├── users/ · groups/ · roles/ · permissions/     # RBAC doc §8
│   │   │   └── integrations/        # Google Drive roots + calendars
│   │   └── settings/
│   │       ├── notifications/       # push on this device, per-type toggles
│   │       └── connected-apps/      # list / revoke OAuth grants
│   ├── api/
│   │   ├── mcp/route.ts             # MCP server (backend doc §8)
│   │   ├── chat/route.ts            # in-app AI chat (backend doc §8)
│   │   ├── push/dispatch/route.ts   # web-push sender, called by the DB (PWA doc §7)
│   │   └── calendar/feed/[token]/route.ts   # ICS subscription feed
│   └── .well-known/oauth-protected-resource/route.ts
├── agent/                           # tool registry shared by MCP + in-app chat (backend doc §8)
├── features/
│   ├── rbac/  notifications/  role-mail/  calendar/  kanban/  documents/  talent/  ai-chat/
│   │   (each feature:)
│   │   ├── api/keys.ts              # query-key factory
│   │   ├── api/queries.ts           # read functions taking an injected Supabase client
│   │   ├── api/actions.ts           # 'use server' mutations
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── schemas/                 # Zod, shared by form + action
│   │   └── lib/                     # pure helpers (unit-tested)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # browser client
│   │   ├── server.ts                # server client (cookies)
│   │   ├── proxy.ts                 # updateSession() used by src/proxy.ts
│   │   └── database.types.ts        # GENERATED by `bun run db:types`, never hand-edit
│   └── auth/
│       ├── session.ts               # getSession(): claims → { userId, roles, groups, permissions }
│       └── require.ts               # requirePermission(key)
└── config/                          # template nav config gains a `permission` field (§5)
```

---

## 4. Supabase clients and the session proxy

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

The blocks import the template's own `@/components/ui/*` primitives. After adding them, point them at the client modules above (one client module per side, not two) and convert any `asChild` usage (§9). If onboarding uses Google sign-in (RBAC doc §10), add a "Continue with Google" button calling `supabase.auth.signInWithOAuth({ provider: 'google' })`.

---

## 5. Session, permissions and navigation

The access-token hook ([rbac-architecture.md §5](rbac-architecture.md#5-access-token-hook)) adds `app_roles`, `app_groups` and `app_permissions` to every JWT. The UI reads them from the claims; RLS never trusts them.

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

Guard admin pages and privileged Server Actions with `requirePermission()` ([rbac-architecture.md §7](rbac-architecture.md#7-using-it-in-policies-and-code)). Never check `session.roles.includes('admin')` (contract C-17).

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

---

## 6. Data-layer pattern (copy this for every feature)

Shown for the calendar; every feature follows the same five files.

```ts
// src/features/calendar/api/keys.ts
export const calendarKeys = {
  all: ['calendar'] as const,
  range: (from: string, to: string) => [...calendarKeys.all, 'range', from, to] as const,
};
```

```ts
// src/features/calendar/api/queries.ts  (no 'use client' / 'server-only': runs on both sides)
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// from/to are UTC ISO strings (Date.toISOString()); recurring app events are always fetched
// and expanded client-side for the visible range (§7.3).
export async function fetchEvents(db: SupabaseClient<Database>, from: string, to: string) {
  const { data, error } = await db
    .from('events')
    .select('id, title, description, location, starts_at, ends_at, all_day, rrule, source, ' +
            'event_audience(user_id, role_id, group_id), event_google_links(html_link)')
    .or(`rrule.not.is.null,and(starts_at.lt."${to}",ends_at.gt."${from}")`)
    .order('starts_at');
  if (error) throw error;
  return data;
}
```

```tsx
// src/app/dashboard/calendar/page.tsx  (Server Component)
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client'; // template helper: adjust to its actual export
import { createClient } from '@/lib/supabase/server';
import { calendarKeys } from '@/features/calendar/api/keys';
import { fetchEvents } from '@/features/calendar/api/queries';
import { monthRange } from '@/features/calendar/lib/range';
import { CalendarView } from '@/features/calendar/components/calendar-view';

export default async function CalendarPage() {
  const qc = getQueryClient();
  const db = await createClient();
  const { from, to } = monthRange(new Date());
  await qc.prefetchQuery({ queryKey: calendarKeys.range(from, to), queryFn: () => fetchEvents(db, from, to) });
  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <CalendarView from={from} to={to} />
    </HydrationBoundary>
  );
}
```

```ts
// src/features/calendar/hooks/use-events.ts
'use client';
import { useMemo } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { calendarKeys } from '../api/keys';
import { fetchEvents } from '../api/queries';

export function useEvents(from: string, to: string) {
  const db = useMemo(() => createClient(), []);
  return useSuspenseQuery({ queryKey: calendarKeys.range(from, to), queryFn: () => fetchEvents(db, from, to) });
}
```

```ts
// src/features/calendar/api/actions.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { eventInputSchema, type EventInput } from '../schemas/event';

export async function createEvent(input: EventInput) {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues };

  const db = await createClient(); // runs as the user → RLS applies
  const { audience, ...event } = parsed.data;
  const { data, error } = await db.from('events').insert(event).select('id').single();
  if (error) return { ok: false as const, error: error.message };

  if (audience.length) {
    // One insert statement → one invite notification batch and one Google push.
    const rows = audience.map((a) => ({
      event_id: data.id,
      user_id: a.kind === 'user' ? a.id : null,
      role_id: a.kind === 'role' ? a.id : null,
      group_id: a.kind === 'group' ? a.id : null,
    }));
    const { error: aErr } = await db.from('event_audience').insert(rows);
    if (aErr) return { ok: false as const, error: aErr.message };
  }
  return { ok: true as const, id: data.id };
}
```

On the client, call the action from `useMutation` and `invalidateQueries({ queryKey: calendarKeys.all })` on success, the same way the template's product form does.

**Rules of the pattern**
- Query functions take the Supabase client as a parameter. Never create a client inside them.
- Every mutation is a Server Action that re-validates with the shared Zod schema and returns `{ ok, error }`, never throws to the client.
- Query keys come from the feature's `keys.ts`; no inline arrays.

---

## 7. Feature modules

### 7.1 Kanban (template board → Supabase)

The template board uses dnd-kit for drag-and-drop and Zustand for state. Keep dnd-kit. Replace the Zustand persistence with the query cache; Zustand may stay for pure UI state (open card, drag overlay).

- **Membership:** a board is shared with users and/or groups (`board_members`, `board_groups`).
- **Ordering:** fractional keys, so a move writes one row instead of renumbering a column.

```ts
// src/features/kanban/lib/position.ts
import { generateKeyBetween } from 'fractional-indexing';

export const positionBetween = (prev?: { position: string } | null, next?: { position: string } | null) =>
  generateKeyBetween(prev?.position ?? null, next?.position ?? null);
```

  The DB column is `position text collate "C"` (backend M5) so Postgres sorts exactly like JavaScript string comparison. Without `collate "C"` the order drifts.

- **Move:** on drag end, `setQueryData` optimistically, then call `moveTask(taskId, toColumnId, position)`; roll back on `{ ok: false }`.
- **Assign:** changing the assignee notifies them (`task.assigned`, PWA doc §4).
- **Realtime:**

```ts
// src/features/kanban/hooks/use-board-realtime.ts
'use client';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { kanbanKeys } from '../api/keys';

export function useBoardRealtime(boardId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`board:${boardId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `board_id=eq.${boardId}` },
        () => qc.invalidateQueries({ queryKey: kanbanKeys.board(boardId) }))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [boardId, qc]);
}
```

### 7.2 Role and group mail (the one-liner)

Routes: `/dashboard/mail` (inbox: messages you sent or received), `/dashboard/mail/[id]`, `/dashboard/mail/compose`.

- **Targets:** a role (`to:projectmanager`) or a group (`to:group:pflp-batch-7`). Role targets include people who hold the role through a group.
- **Inbox:** reuse the template chat layout (conversation list → message list → detail). A "conversation" is a target role or group.
- **One-liner input** at the top of the inbox opens compose with target and subject filled in:

```ts
// src/features/role-mail/lib/one-liner.ts
const ONE_LINER = /^to:(?:(group):)?([a-z0-9-]+)\s+(.+)$/i;

export type OneLiner = { kind: 'role' | 'group'; slug: string; subject: string };

export function parseOneLiner(input: string): OneLiner | null {
  const m = input.trim().match(ONE_LINER);
  if (!m) return null;
  return { kind: m[1] ? 'group' : 'role', slug: m[2].toLowerCase(), subject: m[3].trim() };
}
```

- **Compose:** target combobox (roles and groups, labelled), live recipient count via `rpc('mail_recipient_count')` (a count, never emails), subject, Markdown body with preview. Needs `mail.send`.
- **Send:** Server Action `sendRoleMail` inserts the message with `status: 'queued'`, then calls `db.functions.invoke('send-role-mail', { body: { messageId } })` with the user's session. The Edge Function resolves recipients, emails them and creates `mail.received` notifications (backend §6.1). Delivery statuses arrive through the Resend webhook; the detail view shows them per recipient.
- **Command palette:** a kbar action "Email a role or group…" routes to compose.

### 7.3 Agenda calendar (ported big-calendar + Google)

1. Copy only `src/calendar/` from `lramos33/big-calendar` into `src/features/calendar/big-calendar/`. **Do not copy its `src/components/ui/`**: those are Radix-based and would fight the template's Base UI primitives.
2. Point its imports at the template's `@/components/ui/*`. Add any missing primitive with the shadcn CLI (the template's `components.json` already targets Base UI).
3. Replace `asChild` with `render`, e.g. `<DialogTrigger render={<Button variant="outline" />}>New event</DialogTrigger>`.
4. Remove big-calendar's react-dnd drag-to-reschedule in v1 (edit times in the event dialog). If dragging is wanted later, rebuild it with dnd-kit, which the template already ships. One drag-and-drop library, not two.
5. Feed its `CalendarProvider` from `useEvents()`. Map DB rows to big-calendar's event type; expand `rrule` with the `rrule` package for the visible range.
6. Store UTC, display `Asia/Jakarta` (use `TZDate` from `@date-fns/tz`).
7. Event form: title, time range, all-day, location, audience picker (users, roles **and groups**), optional "also send role mail" (PSI-043). Audience members get an `event.invited` notification automatically.
8. **Google:** events with `source = 'google'` get a "Google" badge, open read-only and link to Google Calendar. The form lists the linked Google calendars the event will be pushed to (Google doc §8).
9. "Subscribe" button copies the user's ICS feed URL (`/api/calendar/feed/<token>`).

### 7.4 Documents (Google Drive)

`/dashboard/documents` lists the Drive roots the user can see, a folder tree, and a data table with name filter and "search inside documents". `/dashboard/documents/[id]` streams the file through `google-drive/file` into an in-page viewer. Full spec: [google-workspace-integration.md §8](google-workspace-integration.md#8-frontend).

### 7.5 Notifications and PWA

`/dashboard/notifications` is the PWA start page; the header bell shows the live unread count; `/dashboard/settings/notifications` enables push per device and mutes types. Manifest, service worker, subscription and dispatch: [pwa-notifications.md](pwa-notifications.md).

### 7.6 Admin (users, groups, roles, permissions, integrations)

Pages under `/dashboard/admin/`, each guarded with `requirePermission()`. Role and group assignment are plain Server Actions (RLS enforces the no-escalation rule); invite and suspend call the `admin-users` Edge Function. Spec: [rbac-architecture.md §8–9](rbac-architecture.md#8-admin-pages). Integrations: [google-workspace-integration.md §8](google-workspace-integration.md#8-frontend).

### 7.7 AI chat

The template page already runs the real `useChat` lifecycle with a scripted conversation. Point it at our route:

```ts
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
});
```

The route and its tools are shared with the MCP server (backend §8). Render tool results as cards with the deep links the tools return.

### 7.8 Talent (phase 8)

- Consent screen first (explicit checkbox, UU PDP wording), then either the Supabase Dropzone into the private `cvs` bucket (`<user_id>/<uuid>.pdf`, 2 MB cap) or a link to a CV already in the talent Drive root (Google doc §9).
- Candidate list and pipeline board show **scores and skill names only**. Raw CV text never reaches the browser.

### 7.9 Settings

- **Notifications:** see §7.5.
- **Connected apps:** list the user's OAuth grants (MCP clients such as Claude) with a revoke button, using the Supabase Auth OAuth server APIs. Supabase auto-approves repeat authorizations, so revoking here is the user's only off switch.

---

## 8. Environment variables

| Variable | Visible to | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser + server | Publishable (anon) key only |
| `NEXT_PUBLIC_SITE_URL` | browser + server | Deep links, OAuth redirect, ICS URLs |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | browser + server | Web Push public key |
| `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` | **server only** | Push dispatch route |
| `INTERNAL_FN_SECRET` | **server only** | Authenticates DB → `/api/push/dispatch`; same value in Vault and Edge Function secrets |
| `SUPABASE_SECRET_KEY` | **server only** | Only the ICS feed and push dispatch routes; import from a `server-only` module |
| `ANTHROPIC_API_KEY` | **server only** | `/api/chat` |
| `CHAT_MODEL` | server | Defaults to `claude-sonnet-5` |
| `SENTRY_*` | template | Keep or remove with the cleanup script |

Resend keys and the Google service-account key live in **Edge Function secrets**, never in the Next.js env (contract C-18).

---

## 9. Conventions and guardrails

- **Permissions, not roles.** `requirePermission('mail.send')`, never `roles.includes('projectmanager')` (C-17).
- **Base UI, not Radix.** Use `render` for composition. When pasting code from Radix-based sources (big-calendar, older blocks), convert `asChild` before committing.
- **Server/client boundary.** Default to Server Components; add `'use client'` at the smallest leaf that needs state or effects. Any module touching a secret starts with `import 'server-only'`.
- **One Supabase client module per side.** No ad-hoc `createClient` calls in components.
- **UTC in, WIB out.** All timestamps cross the wire as UTC ISO strings; format for `Asia/Jakarta` at render time.
- **Mobile first for the PWA pages** (notifications, mail detail, agenda day view): they are what people open from a push.
- **Errors.** Server Actions return `{ ok: false, error }`; components show a toast. Unexpected throws hit the template's Sentry-wired error boundary.
- **Types.** Import row types from `database.types.ts` (`Database['public']['Tables']['events']['Row']`). Never redeclare a DB shape by hand.
- **Deep links** follow `/dashboard/<feature>/<id>` (query params for calendar and board items). Notifications and agent tools rely on this shape.

---

## 10. Testing

| Layer | Tool | What |
|---|---|---|
| Pure logic | Vitest | `parseOneLiner`, `positionBetween`, rrule expansion, `visibleNav` |
| Flows | Playwright (smoke) | sign in → send mail to a test role and a test group → create an event with a group audience → move a card → open a document |
| Database | pgTAP (`supabase test db`) | RLS policies and RBAC guards (backend doc §10, RBAC doc §11) |
| Devices | Manual | PWA install + push on Android and iPhone (PWA doc §10) |

Keep the smoke suite under ~2 minutes so agents actually run it.
