# AGENTS.md

**First read: [README_AI_AGENT.md](./README_AI_AGENT.md)** — the project gateway, contract, and boot sequence.

This file holds project-level conventions that AI agents (Claude Code, Hermes, Cursor, etc.) must follow. It merges the template conventions from the Kiranism starter with the P3MD-specific rules.

---

## Project Overview

**P3MD Social Integration** — built on Kiranism `next-shadcn-dashboard-starter` (Next.js 16, React 19, shadcn/ui on Base UI, TanStack Query + Form, Zod, bun) + Supabase (Postgres + RLS, Auth + OAuth 2.1, Storage, Realtime, Edge Functions, pg_cron) + Google Drive/Calendar (service account) + Web Push + LLMs (Claude and Hermes models).

Built by two agents: **Claude Code** (default builder) and **Hermes Agent** (default operator), both with ECC and graphify.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.7+ strict |
| Styling | Tailwind CSS v4 (`@import 'tailwindcss'`), PostCSS |
| UI | shadcn/ui (New York), Radix UI primitives, OKLCH theme |
| State | Zustand 5.x (local UI), Nuqs (URL params) |
| Forms | TanStack Form + Zod (`createFormHook`) |
| Data | TanStack React Query |
| Backend | Supabase (Auth, RLS, Edge Functions, pg_cron) |
| Integration | Google Drive/Calendar (service account) |
| Push | Web Push + PWA |
| AI Tools | ECC, graphify |
| Package | Bun (primary), npm (secondary) |

---

## Critical Conventions

### Data Fetching
- **React Query** for all data — `void prefetchQuery()` on server + `useSuspenseQuery` on client (standard TanStack pattern), `useMutation` for forms, `HydrationBoundary` + `dehydrate` for hydration, `<Suspense fallback>` for streaming
- **API layer** per feature — `api/types.ts` → `api/service.ts` → `api/queries.ts`; queries use key factories (`entityKeys.all/list/detail`); components import from service and queries, never from mock APIs directly

### Forms
- **`useAppForm`** from `@/lib/form` (TanStack `createFormHook`) + `form.AppField` rendering field components in `@/components/forms/fields` (`field.TextField`, `field.SelectField`, …); each component follows the shadcn TanStack Form doc anatomy; raw `form.Field` for one-off custom fields; form-level Zod `onSubmit` validators

### Routing & Params
- **nuqs** for URL search params — `searchParamsCache` on server, `useQueryStates` on client, use `getSortingStateParser` for sort (same parser as `useDataTable`)

### Styling
- **Icons** — only import from `@/components/icons`, never from `@tabler/icons-react` directly
- **Page headers** — use `PageContainer` props (`pageTitle`, `pageDescription`, `pageHeaderAction`), never import `<Heading>` manually
- **Formatting** — single quotes, JSX single quotes, no trailing comma, 2-space indent

---

## Repository Structure

```
/
├── README_AI_AGENT.md     # Gateway & contract (READ FIRST)
├── CLAUDE.md              # Claude Code entry point
├── AGENTS.md              # This file — agent conventions
├── .hermes.md             # Hermes Agent context (generated)
├── docs/
│   ├── system-overview.md           # Layer ownership map
│   ├── frontend-architecture/       # Browser & Next.js
│   ├── backend-architecture/        # Edge Functions, Auth, Google, Push
│   ├── database-architecture/       # SQL migrations, RLS, functions
│   ├── agent-operations/            # ECC, graphify, handoffs
│   ├── graphify-architecture/       # Code graph
│   ├── list-task-project.md         # Task board source
│   ├── historical-agent-work.md     # Session audit trail
│   └── integrated-obsidian-local.md # Obsidian vault docs
├── agent-history/entries/           # One JSON file per AI session
├── scripts/                         # obsidian-sync.ts, agent-context.ts
├── obsidian-out/                    # Generated Kanban board
├── supabase/                        # Local Supabase (config.toml, migrations, seed.sql)
└── frontend-architecture/           # Next.js app source
```

---

## Agent Rules (from Contract C-03)

1. **One task per session** — pick from `docs/list-task-project.md`. No fitting task → append one with `status: backlog`.
2. **Change only `status` and `owner`** lines in the task list (C-03). Never set `done` — a human does that.
3. **Read before write** — `docs/system-overview.md` first, then only the file your task touches.
4. **Graph before grep** — `graphify query "<question>"` or skim `graphify-out/GRAPH_REPORT.md`. Grep only when the graph misses.
5. **Write a history entry** — one JSON file in `agent-history/entries/` per session, even for failures.
6. **Branch from `master`** — default branch is `master` (not `main`). Branch name: `task/PSI-NNN`. Never work on `master` directly.
7. **Never merge without review** — all PRs need a review file (`obsidian-out/review/PSI-NNN.md`) before merge.
8. **No GCP/GCloud without permission** — never touch remote cloud infrastructure.