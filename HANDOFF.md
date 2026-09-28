---
updated: 2026-09-28 23:00 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-077 · Daily digest** — **DONE (agent scope)**, code and migrations merged into `master` at `5fc799b` (PR #63).

What landed:
- `supabase/migrations/20260928230000_m11_daily_digest_cron.sql`:
  - Schedules pg_cron job `daily-digest` at 06:00 WIB (23:00 UTC) calling `public.internal_post('functions', 'daily-digest')`.
- `supabase/functions/daily-digest/`:
  - `index.ts`: Edge Function entry point with internal secret assertion (`assertInternal(req)`).
  - `digest.ts`: gathers 24h `activity_log`, today's `events`, and overdue/open `tasks`; builds prompt and calls `complete()` from `_shared/llm.ts` with `DIGEST_MODEL` (`anthropic:claude-haiku-4-5-20251001` or `hermes`).
  - Inserts into `public.digests`.
  - Dispatches push notifications via `notify()` RPC for all users holding `digest.receive` permission.
- Overview UI:
  - `src/features/overview/components/daily-digest-card.tsx`: collapsible morning briefing card with generation timestamp in WIB, model name badge, and clean markdown display.
  - `src/features/overview/actions.ts`: `getLatestDigestAction()` gated by `digest.receive` permission.
  - `src/app/dashboard/overview/layout.tsx`: integrates Daily Digest card on the Overview dashboard for authorized users.
- Unit tests:
  - `supabase/functions/daily-digest/digest.test.ts` (4 tests passing).
  - `src/features/overview/__tests__/overview-digest.test.ts` (2 tests passing).

## Prior Cards (this session)

- **PSI-074 · Supabase OAuth 2.1 server, consent page, resource metadata** — **DONE** (PR #59, `296a771`)
- **PSI-075 · Connected apps page** — **DONE** (PR #60, `c3a787d`)
- **PSI-078 · Verify MCP client compatibility (CIMD vs DCR)** — **DONE** (PR #61, `4dce5da`)
- **PSI-098 · Provider-agnostic LLM layer (Claude + Hermes) and evaluation** — **DONE** (PR #62, `331e556`)

## Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler)

- **PSI-096** · Hermes standing jobs: **BLOCKED** per operator instruction. All 4 jobs **paused** in scheduler (enabled=false). Nothing fires. Do not resume without explicit operator instruction.
- **PSI-077** · Daily digest uses Supabase database `pg_cron` (independent of Hermes host scheduler).

## Next Unblocked Candidate Tasks

1. **PSI-076 · Live in-app AI chat on the shared tools** (`onhold`, area: frontend, depends: PSI-072, PSI-098 — unblocked):
   - In-app assistant UI at `/dashboard/chat` using AI SDK `streamText` with the shared read-only tool registry (`get_board`, `get_agenda`, `get_activity`, `get_inbox`, `get_finance`, `search_documents`).
2. **PSI-081 · Consent and CV intake** (`onhold`, area: frontend, talent search module).

## Human / Infra Next Actions

- **PSI-031 · Resend API key and webhook secret** (`infra`, depends PSI-011) — operator provisions Resend credentials.
- **PSI-090 · Vercel project and environments** (`infra`, depends PSI-016).
- **PSI-025 · Device QA for install and push** (`frontend`, physical mobile device QA).

## Test & Build Status

- Frontend tests: **113/113 passing** (`bun test src/`)
- Edge fns: **22/22 passing** (`bun test supabase/functions`)
- Typecheck: **clean (0 errors)** · Lint: **0 warnings / 0 errors**
- `agent:check`: **ok (86 tasks, 77 history entries)**

## Master State

- `master` @ `5fc799b` (PR #63 merge). Working tree clean.

## Exact Next Action

Activate **PSI-076 · Live in-app AI chat on the shared tools** or proceed with Talent module tasks (**PSI-081**).
