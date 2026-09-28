---
updated: 2026-09-28 23:59 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-111 · Contextual feature onboarding & route-specific "Take Tour" system** — **DONE (agent scope)**, code merged into `master` at `e8558b5` (PR #65).

What landed:
- `src/features/tour/types.ts`: TypeScript interfaces for `TourStep`, `RouteTourConfig`, and `TourContextValue`.
- `src/features/tour/config/routes-tour.ts`:
  - Route-specific tour configurations tailored to each module:
    - `/dashboard/overview`: Morning AI briefing (06:00 WIB model badge), financial KPIs, activity charts, fast search.
    - `/dashboard/finance`: Inflow/outflow/net cashflow in IDR, "+ Add Entry" transaction modal with board/task tagging, searchable ledger table, AI assistant queries.
    - `/dashboard/kanban` & `/dashboard/boards`: Multi-board switching, workflow columns with drag-and-drop, Task Detail Dialog with linked Google Calendar events + task-scoped finance entries.
    - `/dashboard/calendar`: Google Calendar 2-way sync, interactive agenda, event → board streamline.
    - `/dashboard/ai-chat`: Grounded tool execution (`get_board`, `get_finance`, etc.), prompt suggestions, multi-provider inference (Claude, DeepSeek, Hermes).
    - `/dashboard/documents`: Google Drive document sync, role/group RBAC protection.
    - `/dashboard/talent`: Candidate pipeline stages, private CV uploads with explicit consent, AI skill taxonomy.
    - `/dashboard/settings`: Connected apps, OAuth 2.1 authorization, instant access revocation.
    - Universal fallback tour for unknown routes.
- `src/features/tour/context/tour-context.tsx`:
  - `TourProvider` & `useTour()` hook.
  - Auto-prompts first-time visitors per route via `localStorage` tracking (`p3md_tour_seen_<route>`) with a gentle 1.2s delay.
  - Replay anytime for returning users via manual trigger.
- `src/features/tour/components/tour-modal.tsx`:
  - Interactive multi-step dialog with animated progress bar, step badges, feature description, action hints, step dot navigation, keyboard arrow controls, and "Don't auto-show again" preference checkbox.
- `src/features/tour/components/tour-trigger.tsx`:
  - Top navigation header `?` icon button with a popover showing current page feature summary, step count, "Take Tour" button, and "Reset all feature tours" action.
  - Animated pulsing dot when the user has not yet seen the current route's tour.
- Integrated into `src/components/layout/providers.tsx` and `src/components/layout/header.tsx`.
- Unit tests in `src/features/tour/__tests__/tour.test.ts` (3 tests passing).

## Prior Cards (this session)

- **PSI-076 · Live in-app AI chat on the shared tools** — **DONE** (PR #64, `6dfd80f`)
- **PSI-077 · Daily digest** — **DONE** (PR #63, `5fc799b`)
- **PSI-074 · Supabase OAuth 2.1 server, consent page, resource metadata** — **DONE** (PR #59, `296a771`)
- **PSI-075 · Connected apps page** — **DONE** (PR #60, `c3a787d`)
- **PSI-078 · Verify MCP client compatibility (CIMD vs DCR)** — **DONE** (PR #61, `4dce5da`)
- **PSI-098 · Provider-agnostic LLM layer (Claude + Hermes) and evaluation** — **DONE** (PR #62, `331e556`)

## Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler)

- **PSI-096** · Hermes standing jobs: **BLOCKED** per operator instruction. All 4 jobs **paused** in scheduler (enabled=false). Nothing fires. Do not resume without explicit operator instruction.
- **PSI-077** · Daily digest uses Supabase database `pg_cron` (independent of Hermes host scheduler).

## Next Unblocked Candidate Tasks (Phase 8: Talent Search)

1. **PSI-081 · Consent and CV intake** (`onhold`, area: frontend, depends: PSI-080):
   - PDF upload to Supabase storage bucket `cvs`, background parsing with `CV_MODEL`, and candidate profile creation with consent checkbox.
2. **PSI-083 · Skill taxonomy admin** (`onhold`, area: frontend, depends: PSI-080):
   - Admin UI for managing skill taxonomy categories and synonyms.

## Human / Infra Next Actions

- **PSI-031 · Resend API key and webhook secret** (`infra`, depends PSI-011) — operator provisions Resend credentials.
- **PSI-090 · Vercel project and environments** (`infra`, depends PSI-016).
- **PSI-025 · Device QA for install and push** (`frontend`, physical mobile device QA).

## Test & Build Status

- Frontend tests: **123/123 passing** (`bun test src/`)
- Edge fns: **22/22 passing** (`bun test supabase/functions`)
- Typecheck: **clean (0 errors)** · Lint: **0 warnings / 0 errors**
- `agent:check`: **ok (87 tasks, 79 history entries)**

## Master State

- `master` @ `e8558b5` (PR #65 merge). Working tree clean.

## Exact Next Action

Activate Phase 8 Talent Search cards (**PSI-081** / **PSI-083**).
