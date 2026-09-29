---
updated: 2026-09-29 16:40 WIB
project: super-dashboard-p3md-architecture
---

## Current priority: Phase 11 (kanban task → CPM network → earned value)

**Read [docs/agent-operations/phase-11-brief.md](docs/agent-operations/phase-11-brief.md) before claiming any Phase 11 task.** It holds the job description, the operator's frozen decisions (D1–D9), the glossary with the test fixture, the task order and the per-task traps.

- **PSI-114** · Design (claude-code, branch `task/PSI-114`): `m12-task-lifecycle-cpm.md` + `features/cpm-evm.md` + the brief. Wait for it to merge before building on it.
- **Can start now (no dependency on PSI-114):** PSI-123 (kanban/finance UI bug fixes; PSI-118 depends on it).
- **After PSI-114 merges:** PSI-119 (pure CPM/PERT engine, TDD) · PSI-115 (M12 migration, needs a human RLS review) → PSI-116, PSI-117 → PSI-118, PSI-120, PSI-121 → PSI-122.
- The operator assigns tasks; the brief's §4 has a suggested Hermes / Claude Code split.

## Latest Delivered Features

1. **UI/UX Motion System & Cognitive Laws (`motion.js` / `motion/react`)** — **MERGED** (`4681125`, PR #70):
   - Added staggered entry grids (`AnimatedStatsGrid`, `AnimatedChartsGrid`) using Law of Continuity.
   - Added tactile micro-interactions (`whileHover`, `whileTap`) across Kanban TaskCards under Doherty Threshold (<400ms).
2. **RBAC Admin Guided Onboarding Tour** — **MERGED** (`7410461`, PR #69):
   - Added tour walkthrough on `/dashboard/admin/*` covering user management, groups, role-permission matrix, and catalogue.
3. **Frontend Dockerization & Dedicated Compose** — **MERGED** (`22207a7`, PR #68):
   - Standalone Next.js Dockerfile and dedicated `docker-compose.frontend.yml` on port 3000 connecting to Supabase via host gateway.
4. **Persona Accounts for Human Review** — **MERGED** (`28ea02a`, PR #67):
   - Provisioned database migration and local seed for Project Manager (`pm@p3md.test`), Operation (`operation@p3md.test`), and Finance (`finance@p3md.test`).
5. **PSI-111 · Contextual feature onboarding & route-specific "Take Tour" system** — **MERGED** (`e8558b5`, PR #65).
3. **PSI-076 · Live in-app AI chat on the shared tools** — **MERGED** (`6dfd80f`, PR #64).
4. **PSI-077 · Daily digest** — **MERGED** (`5fc799b`, PR #63).

## Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler)

- **PSI-096** · Hermes standing jobs: **BLOCKED** per operator instruction. All 4 jobs **paused** in scheduler (enabled=false). Nothing fires. Do not resume without explicit operator instruction.
- **PSI-077** · Daily digest uses Supabase database `pg_cron` (independent of Hermes host scheduler).

## Phase 8 (Talent) is on hold

Put on hold by the operator on 2026-09-27 to prioritise the calendar → kanban → finance streamline, now extended by Phase 11. Do not pick PSI-081 / PSI-083 until the operator moves them back.

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

- `master` @ `d8bf781` (PSI-113 stamped, PR #74). Also merged since the last handoff: PR #72 (PSI-112 motion guardrails), PR #73 (Docker server-side Supabase URL fix), `351ac1f` (seed `::uuid` casts for persona roles).
