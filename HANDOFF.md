---
updated: 2026-09-27 15:20 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-066 · google-calendar /push** — implemented on `task/PSI-066`, **status: review**, PR #45 open + mergeable.
Needs a human for final stamp: the AC requires a *live* upsert/delete against a real shared
Google calendar (PSI-062's human step — SA sees 0 calendars until calendars are shared).

What landed:
- `supabase/functions/google-calendar/push.ts` — pure logic, free of Deno/Supabase runtime imports:
  deterministic UUID-hex Google event id (`toGoogleId`), all-day-vs-timed mapper (`toGoogleEvent`,
  RRULE prefix, private `p3md_event_id` property for round-trip), and `reconcilePush`
  (op=delete; op=upsert with POST-then-PUT-on-409 idempotency, audience role/group gating,
  stale-link cleanup). Scopes constant local to push.ts (keeps bun tests green; `_shared/google.ts`
  pulls npm:jose which bun cannot resolve).
- `supabase/functions/google-calendar/push.test.ts` — 9 unit tests; 15/15 pass with sync.test.ts.
- `supabase/functions/google-calendar/index.ts` — wired real `/push` route (was a stub): method/JSON
  validation, `event_id` required, fetch event+audience+calendars+links, skip non-`app` source
  (loop prevention), upsert/delete `event_google_links` rows.
- Verified end-to-end on local Supabase: empty body → 400, nonexistent-event upsert → 404,
  delete empty-links → 200 `{ok:true,pushed:0,deleted:0}`. Full gates green: 15/15 fn tests,
  23/23 frontend, lint+tsc clean, `supabase test db` 10 files/135 pgTAP, `agent:check` ok.
- AI session recorded + rendered under PSI-066 `## AI sessions` (C-22/C-23).

## Master State

`master` is at `5a74281` (PR #46, repo hygiene: `.obsidian/*` app state + plugins gitignored).
`task/PSI-066` merged master in (`5251947`) and is at `c855fb6` — PR #45 is clean/mergeable.
Working tree is clean.

## Next Card

**Unblocked cards for the next session** (PSI-082 + talent phase frozen by operator):
- **PSI-066 review stamp** — run one live upsert/delete once a calendar is shared with the SA.
- **Next Ready card on the board** — verify on `docs/list-task-project.md` (PSI-082 + dependents remain blocked).

## Last Commit

`c855fb6` — chore(obsidian): sync docs mirror for PSI-066 review status [card: PSI-066]
(feat commit `3cd9e6a`; handoff `b55e3a2`; master merge `5251947`)

## Coordination rules (docs/agent-operations/README.md)

1. Never switch branches in a dirty shared working directory — commit/stash first, use worktrees for parallel work.
2. A blocker already hit once is escalated (re-ask), not retried.
3. Obsidian app state (`.obsidian/*`, plugins/) is never committed — gitignored.