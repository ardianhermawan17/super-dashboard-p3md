---
updated: 2026-09-28 20:30 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-075 · Connected apps page** — **DONE (agent scope)**, code merged into `master` at `c3a787d` (PR #60).

What landed:
- `src/features/connected-apps/types.ts` & `src/features/connected-apps/lib/format.ts`:
  - Formatted scope labels/descriptions (OpenID, Profile, Email, Offline Access, custom scopes).
  - WIB (`Asia/Jakarta`) and relative (`Just now`, `15m ago`, `2d ago`) timestamp formatting.
- `src/features/connected-apps/actions.ts`:
  - `listConnectedAppsAction`: fetches user's active OAuth grants via `supabase.auth.oauth.listGrants()`.
  - `revokeConnectedAppAction`: revokes access for a specific client via `supabase.auth.oauth.revokeGrant({ clientId })` and revalidates dashboard paths.
- `src/features/connected-apps/components/`:
  - `ConnectedAppsPage`: page container with header refresh action, informative banner about MCP/OAuth access, loading skeletons, and empty state with MCP endpoint hint (`/api/mcp`).
  - `ConnectedAppCard`: app card with client logo/avatar, client name, website link, connection timestamp, and scope badges.
  - `RevokeAppDialog`: confirmation modal explaining that revoking immediately invalidates tokens and disconnects active sessions.
- Routes:
  - `/dashboard/connected-apps`
  - `/dashboard/settings/connected-apps` (alias)
- Navigation:
  - Added `Connected Apps` under `Account` nav items in `src/config/nav-config.ts`.
  - Added `Connected Apps` shortcut in user avatar dropdown menu in `src/components/layout/app-sidebar.tsx`.
- Unit tests:
  - `src/features/connected-apps/__tests__/connected-apps.test.ts` (11/11 tests pass).

**Deterministic local verification**:
- Registered dynamic client -> PKCE authorization -> consent approved -> `listGrants()` returns active grant with client metadata and scopes.
- `revokeGrant({ clientId })` revokes grant -> `listGrants()` returns 0 active grants.

## Prior Card

**PSI-074 · Supabase OAuth 2.1 server, consent page, resource metadata** — **DONE (agent scope)**, code merged into `master` at `296a771` (PR #59).

## Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler)

- **PSI-096** · Hermes standing jobs: **BLOCKED** per operator instruction. All 4 jobs **paused** in scheduler (enabled=false). Nothing fires. Do not resume without explicit operator instruction.

## Unblocked Next Candidates

- **PSI-078 · Verify MCP client compatibility (CIMD vs DCR)** (`backlog`, depends PSI-073, PSI-074 — unblocked now): Testing and documenting compatibility for Claude Desktop, Cursor, ChatGPT, and custom agents against Supabase OAuth 2.1 endpoints.

## Test & Build Status

- Frontend tests: **97/97 passing** (`bun test src/`)
- Edge fns: **15/15 passing**
- Typecheck: **clean (0 errors)** · Lint: **0 warnings / 0 errors**
- `agent:check`: **ok (86 tasks, 74 history entries)**

## Master State

- `master` @ `c3a787d` (PR #60 merge). Working tree clean.

## Exact Next Action

Claim **PSI-078 · Verify MCP client compatibility (CIMD vs DCR)** on branch `task/PSI-078` — verify client metadata documents vs dynamic client registration across external MCP clients.
