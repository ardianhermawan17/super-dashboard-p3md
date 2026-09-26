---
updated: 2026-09-26 15:55
project: super-dashboard-p3md-architecture
---

## Current Card

`PSI-065 · google-calendar /sync (pull)` — **review**.
- Implementation: `supabase/functions/google-calendar/index.ts` + `mapper.ts`
- Shared helpers: `supabase/functions/_shared/google.ts` (RS256 JWT SA signer) + `_shared/internal.ts` (bearer authentication)
- Unit tests: `supabase/functions/google-calendar/sync.test.ts` (6/6 pass)
- Database tests: `supabase/tests/google.test.sql` (13/13 pass, 64 total across suite)
- Branch: `task/PSI-065`
- PR: **#36** (awaiting merge)

## Parallel Human Card

`PSI-060 · Google Cloud project, service account, sharing` — **doing**.
- Project + SA: `p3md-sync@project-c3a74e7a-ee76-4908-963.iam.gserviceaccount.com`
- APIs: Calendar API **HTTP 200**, Drive API **HTTP 200** (both active).
- **Waiting on human:** Share target calendar with the SA email. Currently SA sees 0 calendars.

## Next Card

1. **`PSI-066 · google-calendar /push`** (depends on PSI-065). Edge Function route `/push` to export app events to linked Google calendars.
2. Follow-up: **`PSI-071 · Migration M8 agent views, audit log, digests`** (Phase 7, fully unblocked).

## Test Status

unit: 6 passed (sync.test.ts) · full suite: **pass** (7 pgTAP files / 64 tests) ·
lint: pass (0 warnings, 0 errors on 282 files) · typecheck: pass · build: pass (all 25 routes registered) ·
`bun run agent:check`: ok (75 tasks, 44 history entries)
