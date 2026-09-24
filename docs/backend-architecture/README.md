# Backend architecture

> **Scope:** everything that runs server-side **outside Postgres**: Supabase Auth configuration, Edge Functions (Deno), Next.js route handlers, external integrations (Resend, Google, LLM providers), the agent/MCP layer, deployment and operations.
> SQL (schema, RLS, functions, triggers, cron) lives in [database-architecture/](../database-architecture/README.md). UI in [frontend-architecture/](../frontend-architecture/README.md). Placement rule: [system-overview.md](../system-overview.md). Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Files in this folder

| File | Read it when |
|---|---|
| [local-workflow-and-deploy.md](local-workflow-and-deploy.md) | Running Supabase locally, repo layout of `supabase/`, deploying, project settings, secrets |
| [auth-and-onboarding.md](auth-and-onboarding.md) | Auth hooks, SMTP, onboarding ~400 users, the OAuth 2.1 server for agents |
| [edge-functions.md](edge-functions.md) | send-role-mail, resend-webhook, admin-users, daily-digest, parse-cv |
| [google-integration.md](google-integration.md) | Service account, google-drive and google-calendar functions |
| [push-notifications.md](push-notifications.md) | Who creates notifications, the Web Push dispatch route |
| [agent-layer-mcp.md](agent-layer-mcp.md) | Tool registry, `/api/mcp`, `/api/chat`, LLM providers (Claude + Hermes) |
| [operations-and-risks.md](operations-and-risks.md) | Security controls, quotas, free tier, open risks |

## Topology

```
        Browser / installed PWA                    MCP clients (Claude, ChatGPT, Cursor)
              │ cookies · Web Push                              │ OAuth 2.1 bearer
              ▼                                                 ▼
┌──────────────────────────── Next.js 16 on Vercel ──────────────────────────────┐
│ Server Components + Server Actions (run as the user)    /api/chat    /api/mcp   │
│ /api/push/dispatch (web-push)    /api/calendar/feed (ICS)    /.well-known       │
└───────────────┬────────────────────────────────────────────────┬───────────────┘
                │ user JWT (RLS applies)                         │ user JWT (RLS applies)
                ▼                                                ▼
┌──────────────────────────────── Supabase (Singapore) ───────────────────────────┐
│ Auth: sessions · OAuth 2.1 server · access-token hook                            │
│ Postgres + RLS: rbac · notifications · messages · events · tasks · drive_files   │
│                 activity_log · agent_* views                                     │
│ Realtime: tasks, board_columns, notifications     Storage: private `cvs` bucket  │
│ pg_cron + triggers ─▶ internal_post() ─▶ pg_net ─▶ Edge Functions / Next.js      │
│ Edge Functions: send-role-mail · resend-webhook · admin-users · google-drive ·   │
│                 google-calendar · daily-digest · parse-cv                        │
└───────────────┬─────────────────────────────┬─────────────────────┬─────────────┘
                ▼                             ▼                     ▼
          Resend (email)       Google Drive + Calendar (service account)   Anthropic API
```

| Component | Owns | Never does |
|---|---|---|
| Postgres + RLS | All authorization; SQL-shaped logic (resolvers, triggers, views) | Call external APIs directly (it asks pg_net to) |
| Edge Functions | External APIs (Resend, Google, LLM) and service-role work | Hold business rules that SQL can express |
| Next.js route handlers | Agent surfaces (MCP, chat), token URLs (ICS), Web Push sending | Use the secret key when the user's JWT is enough |
| Auth | Sessions, OAuth 2.1 for agents, claims for the UI | Decide data access (RLS reads tables, not claims) |

## Principles

1. **RLS-first.** Every table has RLS on from its first migration. The UI hiding something is never the control.
2. **Permissions, not roles.** Policies call `has_permission('<key>')`, never compare role or group slugs (contract C-17, [m1-rbac.md](../database-architecture/m1-rbac.md)).
3. **SQL first, Edge Functions for the edge.** Anything expressible in SQL is a function, view or trigger. Edge Functions only for external APIs or service-role work. Two documented exceptions run in Next.js: Web Push sending (needs Node crypto) and the ICS feed.
4. **Agents read curated surfaces.** Agents see `activity_log` and `agent_*` views through a small tool registry, never raw tables, and always as the calling user.
5. **Personal data minimization.** Email addresses leave the database only inside `send-role-mail` and `admin-users`. CV text never leaves `parse-cv`. Document content never leaves `google-drive/file` (C-08, C-18).
6. **Idempotent side effects.** Every job that sends something claims its row atomically (`queued → sending`) or uses deterministic external IDs before acting.
7. **One way to call inward.** Triggers and cron call Edge Functions and Next.js routes only through `internal_post()` with the shared `INTERNAL_FN_SECRET` ([m2-notifications.md](../database-architecture/m2-notifications.md)).

## Runtimes at a glance

### Edge Functions (Deno, Supabase)

| Function | Caller | Auth | Spec |
|---|---|---|---|
| `send-role-mail` | Compose Server Action | User JWT + `mail.send` | [edge-functions.md](edge-functions.md#send-role-mail-psi-032) |
| `resend-webhook` | Resend | Svix signature | [edge-functions.md](edge-functions.md#resend-webhook-psi-033) |
| `admin-users` | Admin pages | User JWT + `users.manage` | [edge-functions.md](edge-functions.md#admin-users-psi-018) |
| `google-drive` | Cron (`/sync`), browser (`/file`, `/search`) | Internal secret / user JWT | [google-integration.md](google-integration.md#google-drive-edge-function) |
| `google-calendar` | Cron (`/sync`), triggers (`/push`) | Internal secret | [google-integration.md](google-integration.md#google-calendar-edge-function) |
| `daily-digest` | Cron | Internal secret | [edge-functions.md](edge-functions.md#daily-digest-psi-077) |
| `parse-cv` | Trigger after CV intake | Internal secret | [edge-functions.md](edge-functions.md#parse-cv-psi-082-outline) |

Shared modules in `functions/_shared/`: `http.ts` (CORS headers + `json()`; every browser-facing function answers `OPTIONS`), `internal.ts` (`assertInternal(req)` compares the bearer with `INTERNAL_FN_SECRET`), `send.ts` (batched Resend sending, used by mail and invites), `google.ts` (service-account tokens), `llm.ts` (Claude or Hermes completions, see [agent-layer-mcp.md](agent-layer-mcp.md#llm-providers-claude-and-hermes-psi-098)).

### Next.js route handlers (Node, Vercel)

| Route | Caller | Auth | Spec |
|---|---|---|---|
| `/api/mcp` | External MCP clients (Claude, ChatGPT, Hermes Agent, Cursor) | OAuth 2.1 bearer (Supabase JWT) | [agent-layer-mcp.md](agent-layer-mcp.md#mcp-route-mcp-handler-2x) |
| `/api/chat` | In-app assistant | Session cookie | [agent-layer-mcp.md](agent-layer-mcp.md#in-app-chat-route-psi-076) |
| `/api/push/dispatch` | Postgres (pg_net) | `INTERNAL_FN_SECRET` | [push-notifications.md](push-notifications.md#dispatch-route) |
| `/api/calendar/feed/[token]` | Calendar apps | Secret URL token | below |
| `/.well-known/oauth-protected-resource` | MCP clients | Public metadata | [agent-layer-mcp.md](agent-layer-mcp.md#mcp-route-mcp-handler-2x) |

### ICS feed route

`GET /api/calendar/feed/<token>` is public by URL (calendar apps cannot log in). With the push dispatcher, it is one of only two Next.js routes that use the secret key.

1. Look up `calendar_feed_tokens` by token with the service client (server-only module). Unknown token → 404.
2. `rpc('events_for_user', { p_user, p_from: now − 30 days, p_to: now + 180 days })`.
3. Build a VCALENDAR with the `ics` package; respond `text/calendar; charset=utf-8` with `Cache-Control: private, max-age=900`.
4. "Reset link" in the UI deletes the token row; a new one is generated on next visit.

Google Calendar users can also subscribe to this URL, but Google refreshes subscribed feeds slowly (hours); the linked-calendar push ([google-integration.md](google-integration.md#google-calendar-edge-function)) is the fast path.
