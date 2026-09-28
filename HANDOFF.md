---
updated: 2026-09-28 19:30 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-074 · Supabase OAuth 2.1 server, consent page, resource metadata** — **DONE (agent scope)**, code merged into `master` at `296a771` (PR #59).

What landed:
- `src/app/auth/consent/page.tsx` — full consent page with session gate (`getUser()`), `getAuthorizationDetails` load, client avatar/logo + user email + scopes, Approve (`approveAuthorization`) / Deny (`denyAuthorization`) with `skipBrowserRedirect: true` + `router.replace(redirect_url)`, auto-redirect when already approved, and missing/invalid authorization ID error card.
- `src/app/auth/consent/consent-lib.ts` + 6 unit tests in `src/app/auth/consent/__tests__/consent.test.ts` (100% pass).
- `supabase/config.toml` — local OAuth server enabled (`[auth.oauth_server]` enabled=true, authorization_url_path="/auth/consent", allow_dynamic_registration=true).
- `src/app/.well-known/oauth-protected-resource/route.ts` — verified (points to Supabase Auth server).
- **Verified against local stack**: metadata at `/.well-known/oauth-authorization-server`, JWKS is ES256 asymmetric, dynamic registration returns a `client_id`, PKCE authorize as `admin@p3md.test` 302-redirects to `/auth/consent?authorization_id=...`, `getAuthorizationDetails` returns `{client, user, scope}`.

**Hosted follow-ups (human-gated, no Supabase credentials in scope)**:
- Settings → JWT keys: ensure asymmetric keys are active.
- Auth → OAuth Server: enable, dynamic registration on, consent URL `https://<site>/auth/consent`.
- End-to-end connect from Claude Desktop on the hosted project.

## Stamped Review Cards (merged to master earlier this turn)

- **PSI-042** (Event form audience picker + WIB + rrule, PR #57)
- **PSI-066** (google-calendar /push, PR #45)
- **PSI-073** (MCP endpoint mcp-handler 2.x, PR #40)
- **PSI-097** (AgentShield in CI, PR #44)
- **PSI-100** (Finance design docs, PR #41)
- **PSI-101** (Migration M10 finance, PR #43)
- **PSI-102** (Event board from calendar, PR #49)
- **PSI-103** (Finance module CRUD, PR #51)
- **PSI-107** (Board-delete fix M7 trigger, PR #56)

## Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler)

- **PSI-096** · Hermes standing jobs: **BLOCKED** per operator instruction. All 4 jobs **paused** in scheduler (enabled=false). Nothing fires. Do not resume without explicit operator instruction.

## Unblocked Next Candidates

- **PSI-075 · Connected apps page** (`backlog`, depends PSI-074 — unblocked now): UI to view user's OAuth grants and revoke access (calls `auth.oauth.listUserGrants` + `revokeGrant`). Natural continuation of the OAuth/MCP streamline.
- **PSI-078 · Verify MCP client compatibility (CIMD vs DCR)** (`backlog`, depends PSI-073, PSI-074).

## Test & Build Status

- Frontend tests: **86/86 passing** (`bun test src/`)
- Edge fns: **15/15 passing**
- Typecheck: **clean (0 errors)** · Lint: **0 warnings / 0 errors**
- `agent:check`: **ok (86 tasks, 73 history entries)**

## Master State

- `master` @ `296a771` (PR #59 merge). Working tree clean.

## Exact Next Action

Claim **PSI-075 · Connected apps page** on branch `task/PSI-075` — UI to list connected OAuth apps (grants) and revoke them, with full RLS and unit tests. `2026-09-28T07-00-00Z__PSI-096__hermes.json` (outcome `partial`, `human_review.required: true`).

**Exact next action:** operator reviews the first week of runs (contract check first fired today 22:00 WIB); when a week looks good, stamp PSI-096 done (flip status + outcome.

## Recently Merged (this session's context)

- **PSI-107** · board-delete fix — merged PR #56 (`9b0b849`) — new migration nulls `board_id` on task activity when board gone; pgTAP 137 tests pass.
- **PSI-042** · event form audience picker + WIB + rrule — merged PR #57 (`34b6e6f`).
- **PSI-109** · kanban task detail panel — merged PR #55 earlier.

## Backlog state (all other open items are blocked)

- Mail (PSI-032/033/035/036): blocked on PSI-031 (Resend API key — human).
- Google Drive (PSI-062/063/064): blocked on PSI-060 (Google Cloud project — human).
- PSI-077: blocked on PSI-098 (on hold).
- PSI-097 (AgentShield in CI): `review`, owner agent:hermes, depends PSI-009 — needs human review before next step.

## Test & Build Status

- `agent:check` ok: 86 tasks, 71 history entries.
- No code changed this card (scheduler-only).
- Frontend/edge-fn suites last known: 64/64 + 15/15 (unchanged).

## Open Follow-ups

1. PSI-096 one-week acceptance review (operator).
2. Browser walkthroughs (PSI-103/104/106/109) pending seeded-user checks.

## Master State

- `master` @ `fbd79d4` (PR #58). Working tree clean.

## Exact Next Action

Wait on PSI-096 week-of-runs review. If a new unblocked card appears, claim it via the normal flow (branch `agent/PSI-NNN-slug`, history entry, PR).