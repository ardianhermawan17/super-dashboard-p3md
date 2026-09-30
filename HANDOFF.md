---
updated: 2026-09-30 19:46 WIB
project: super-dashboard-p3md-architecture
---

## Current priority: Phase 11 (kanban task → CPM network → earned value)

**Read [docs/agent-operations/phase-11-brief.md](docs/agent-operations/phase-11-brief.md) before claiming any Phase 11 task.** It holds the job description, the operator's frozen decisions (D1–D9), the glossary with the test fixture, the task order and the per-task traps.

- **PSI-114** · Design (claude-code): **MERGED** (`7889569`, PR #75). `m12-task-lifecycle-cpm.md`, `features/cpm-evm.md` and the brief are on `master`.
- **PSI-119** · pure CPM/PERT engine: **MERGED** (`e77350b`, PR #77). `schedule/lib/pert.ts` + `normal-cdf.ts`, 23 unit tests, the brief's 38-week fixture reproduced. `accept:` says σ is a sum along the critical path; the glossary and the code use √Σvariance (2.944 w) — reword it.
- **PSI-123** · kanban/finance UI fixes: **MERGED** (`95fd28c`, PR #76) · **PSI-124** · `.scratch` gitignore: **MERGED** (PR #78).
- **PSI-120** · Schedule tab and Gantt: **in review** — branch `task/PSI-120`. Its DB-free half is done (types, view-model, controls, link guard; 45 new tests) while the migrations are built. Remaining and still gated on **PSI-116**: the frappe-gantt wrapper, the Schedule tab, the link/estimate editors, the board query.
- **Critical path is PSI-115** (M12 migration): a new `task.budget` permission key and an RLS change on `finance_entries`, so it needs a **human RLS review before merge** (C-15) and is Claude Code's lane. Then PSI-116 (M13) → PSI-117 → PSI-118, and PSI-120 / PSI-121 complete, → PSI-122.
- **Four cards are merged or built but await the operator's stamp (C-21):** PSI-114, PSI-119, PSI-123, PSI-124 — all `status: review`. PSI-115 reads as blocked on PSI-114 until it is stamped `done`.

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

- Frontend tests: **214/214 passing** (`bun test` in `frontend-architecture`, 32 files) — re-run on `task/PSI-120`
- Edge fns: **22/22 passing** (last recorded; nothing on `task/PSI-120` touches an edge function)
- Typecheck: **clean (0 errors)** · Lint: **0 errors / 10 pre-existing warnings, none in the new files** · `bun run build`: **exit 0**
- `agent:check`: **ok (100 tasks, 87 history entries)** on `task/PSI-120`

## Master State

- `master` @ `e77350b` — PR #75 (PSI-114 design), #78 (PSI-124 `.scratch` gitignore), #76 (PSI-123) and #77 (PSI-119) are all merged; `task/PSI-120` branched from it and is the only open PR. Also merged since the last handoff: PR #72 (PSI-112 motion guardrails), PR #73 (Docker server-side Supabase URL fix), `351ac1f` (seed `::uuid` casts for persona roles).
