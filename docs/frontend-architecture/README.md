# Frontend architecture

> **Scope:** everything that runs in the browser or renders in Next.js: routes, feature modules, Supabase clients, session and permissions, the PWA shell, UI conventions.
> Server code lives in [backend-architecture/](../backend-architecture/README.md), SQL in [database-architecture/](../database-architecture/README.md). Placement rule: [system-overview.md](../system-overview.md). Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Files in this folder

| File | Read it when |
|---|---|
| [setup-and-structure.md](setup-and-structure.md) | Forking the template, adding packages, finding where a file goes, env vars |
| [supabase-clients-and-session.md](supabase-clients-and-session.md) | Supabase clients, `proxy.ts`, auth pages, session claims, `requirePermission()`, navigation |
| [data-layer-pattern.md](data-layer-pattern.md) | Any read or write: the five-file pattern every feature copies |
| [features/mail.md](features/mail.md) | Role/group mail inbox, compose, one-liner |
| [features/calendar.md](features/calendar.md) | Agenda (big-calendar port, Google events) |
| [features/kanban.md](features/kanban.md) | Board on Supabase, ordering, realtime |
| [features/documents.md](features/documents.md) | Google Drive library and viewer |
| [features/notifications-pwa.md](features/notifications-pwa.md) | PWA manifest, service worker, push opt-in, notification center |
| [features/admin.md](features/admin.md) | Users, groups, roles, permissions, integrations pages |
| [features/ai-chat.md](features/ai-chat.md) | In-app assistant, connected apps (external agents) |
| [features/talent.md](features/talent.md) | CV intake and candidate views |
| [conventions-and-testing.md](conventions-and-testing.md) | Before every PR: conventions, guardrails, tests |

## Decisions at a glance

| Decision | Choice | Why |
|---|---|---|
| Base | Kiranism `next-shadcn-dashboard-starter` (MIT), **one-time fork** | Working tables, forms, kanban, chat and AI-chat plumbing; feature folders; ships `AGENTS.md`, `CLAUDE.md` and a Claude Code skill |
| Framework | Next.js 16 App Router, React 19 | Template default. `proxy.ts` replaces `middleware.ts` in Next.js 16 |
| UI | shadcn/ui on **Base UI** primitives, Tailwind CSS v4 | Template default. Composition uses the `render` prop, not `asChild` |
| Server state | TanStack Query SSR pattern: server `prefetchQuery` → `HydrationBoundary` → client `useSuspenseQuery` | Template default. One cache for server and client |
| Forms | TanStack Form + Zod | Template default. The same Zod schema validates again inside the Server Action |
| Auth | Supabase Auth through `@supabase/ssr`, session read with `getClaims()` | Clerk removed. Claims carry `app_roles`, `app_groups`, `app_permissions` for the UI |
| Access control | Users · Groups · Roles · Permissions; the app checks **permission keys only** | See [m1-rbac.md](../database-architecture/m1-rbac.md). The database enforces; the UI only hides |
| Writes | Server Actions | One place for validation and auth; the browser never holds a privileged key |
| Reads | Supabase client injected into shared query functions | Same function runs on the server (prefetch) and in the browser (refetch) |
| Realtime | Supabase Realtime `postgres_changes` → invalidate the query | Simple and RLS-aware. Upgrade to Broadcast only if boards get busy |
| PWA | Installable, Web Push, start page = notification center; no offline data | See [notifications-pwa.md](features/notifications-pwa.md) |
| Documents | Google Drive metadata mirrored; files streamed through an RLS-checked Edge Function | See [google-integration.md](../backend-architecture/google-integration.md) |
| Package manager | bun | Template default |

**Upstream policy:** after the fork we never pull from upstream (the template author warns that updates cause merge conflicts). Cherry-pick by hand if something upstream is worth having.
