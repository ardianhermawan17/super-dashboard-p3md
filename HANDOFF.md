---
updated: 2026-09-29 00:30 WIB
project: super-dashboard-p3md-architecture
---

## Latest Delivered Features

1. **UI Motion & Micro-Interactions (`motion.js` / `motion/react`)** — **MERGED** (`1569b9c`, PR #66):
   - Added fluid spring physics, `AnimatePresence` step transitions, and cubic-bezier accordions across TourModal, DailyDigestCard, and AiChatInterface.
2. **PSI-111 · Contextual feature onboarding & route-specific "Take Tour" system** — **MERGED** (`e8558b5`, PR #65).
3. **PSI-076 · Live in-app AI chat on the shared tools** — **MERGED** (`6dfd80f`, PR #64).
4. **PSI-077 · Daily digest** — **MERGED** (`5fc799b`, PR #63).

## Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler)

- **PSI-096** · Hermes standing jobs: **BLOCKED** per operator instruction. All 4 jobs **paused** in scheduler (enabled=false). Nothing fires. Do not resume without explicit operator instruction.
- **PSI-077** · Daily digest uses Supabase database `pg_cron` (independent of Hermes host scheduler).

## Next Unblocked Candidate Tasks (Phase 8: Talent Search)

1. **PSI-081 · Consent and CV intake** (`#frontend`, depends: PSI-080):
   - PDF upload to Supabase storage bucket `cvs`, background parsing with `CV_MODEL`, and candidate profile creation with consent checkbox.
2. **PSI-083 · Skill taxonomy admin** (`#frontend`, depends: PSI-080):
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

- `master` @ `1569b9c` (PR #66 merge). Working tree clean.
