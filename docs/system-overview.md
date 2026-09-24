# System overview

> One page to orient before opening a layer folder: what runs where, where a file belongs, and which files each feature touches.
> Gateway: [README_AI_AGENT.md](../README_AI_AGENT.md)

## Three layers, one rule

| Layer | Folder | Runs | Put it here when… |
|---|---|---|---|
| **Frontend** | [frontend-architecture/](frontend-architecture/README.md) | Browser + Next.js rendering (Server Components, Server Actions, PWA shell) | It renders UI, handles a form, or calls Supabase **as the signed-in user** |
| **Backend** | [backend-architecture/](backend-architecture/README.md) | Deno Edge Functions, Next.js route handlers, Supabase Auth config | It calls an external service (Resend, Google, LLMs, Web Push), needs the service role, or serves a non-browser caller (MCP clients, calendar apps, pg_net) |
| **Database** | [database-architecture/](database-architecture/README.md) | Postgres (SQL, RLS, triggers, pg_cron) | It can be expressed in SQL: authorization, resolution, visibility, logging, scheduling |

When in doubt: **SQL first, backend for the edge, frontend for the user.** Authorization always lives in the database (RLS); the other layers only mirror it.

## Topology

```
        Browser / installed PWA                    MCP clients (Claude, ChatGPT, Hermes Agent, Cursor)
              │ cookies · Web Push                              │ OAuth 2.1 bearer
              ▼                                                 ▼
┌──────────────────────────── Next.js 16 on Vercel ──────────────────────────────┐
│ FRONTEND: Server Components + Server Actions (run as the user)                  │
│ BACKEND:  /api/chat · /api/mcp · /api/push/dispatch · /api/calendar/feed        │
└───────────────┬────────────────────────────────────────────────┬───────────────┘
                │ user JWT (RLS applies)                         │ user JWT (RLS applies)
                ▼                                                ▼
┌──────────────────────────────── Supabase (Singapore) ───────────────────────────┐
│ DATABASE: Postgres + RLS · triggers · views · pg_cron ─▶ internal_post() ─▶ pg_net │
│ BACKEND:  Auth (hooks, OAuth 2.1 server) · Edge Functions (mail, admin-users,     │
│           google-drive, google-calendar, daily-digest, parse-cv)                 │
└───────────────┬─────────────────────────────┬─────────────────────┬─────────────┘
                ▼                             ▼                     ▼
          Resend (email)       Google Drive + Calendar (service account)   LLMs: Claude · Hermes
```

## Feature × layer map

| Feature | Frontend | Backend | Database |
|---|---|---|---|
| Access (users, groups, roles, permissions) | [supabase-clients-and-session.md](frontend-architecture/supabase-clients-and-session.md), [features/admin.md](frontend-architecture/features/admin.md) | [auth-and-onboarding.md](backend-architecture/auth-and-onboarding.md), [edge-functions.md → admin-users](backend-architecture/edge-functions.md#admin-users-psi-018) | [m1-rbac.md](database-architecture/m1-rbac.md) |
| Notifications + PWA | [features/notifications-pwa.md](frontend-architecture/features/notifications-pwa.md) | [push-notifications.md](backend-architecture/push-notifications.md) | [m2-notifications.md](database-architecture/m2-notifications.md) |
| Role / group mail | [features/mail.md](frontend-architecture/features/mail.md) | [edge-functions.md → send-role-mail](backend-architecture/edge-functions.md#send-role-mail-psi-032) | [m3-role-mail.md](database-architecture/m3-role-mail.md) |
| Agenda + Google Calendar | [features/calendar.md](frontend-architecture/features/calendar.md) | [google-integration.md](backend-architecture/google-integration.md), [ICS feed](backend-architecture/README.md#ics-feed-route) | [m4-calendar.md](database-architecture/m4-calendar.md), [m6-google.md](database-architecture/m6-google.md) |
| Kanban | [features/kanban.md](frontend-architecture/features/kanban.md) | — | [m5-kanban.md](database-architecture/m5-kanban.md) |
| Documents (Google Drive) | [features/documents.md](frontend-architecture/features/documents.md) | [google-integration.md](backend-architecture/google-integration.md) | [m6-google.md](database-architecture/m6-google.md) |
| AI assistant + MCP | [features/ai-chat.md](frontend-architecture/features/ai-chat.md) | [agent-layer-mcp.md](backend-architecture/agent-layer-mcp.md) | [m7-activity-log.md](database-architecture/m7-activity-log.md), [m8-agent-layer.md](database-architecture/m8-agent-layer.md) |
| Talent | [features/talent.md](frontend-architecture/features/talent.md) | [edge-functions.md → parse-cv](backend-architecture/edge-functions.md#parse-cv-psi-082-outline) | [m9-talent.md](database-architecture/m9-talent.md) |

## Two kinds of "agent" in this project

| | Development agents | Product AI |
|---|---|---|
| What | Claude Code and Hermes Agent writing and operating **this repo** | The assistant, digest and CV parser **inside the app** |
| Models | Whatever each harness is configured with | Claude or Hermes models via `provider:model` specs |
| Governed by | [README_AI_AGENT.md](../README_AI_AGENT.md) contract, [agent-operations/](agent-operations/README.md) | [agent-layer-mcp.md](backend-architecture/agent-layer-mcp.md) |
| Records | `agent-history/entries/*.json` | `agent_audit_log`, `digests.model` |
