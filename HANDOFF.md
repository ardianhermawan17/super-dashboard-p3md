---
updated: 2026-09-27 14:10 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-066 · google-calendar /push** — implemented on `task/PSI-066`, commit `3cd9e6a`, **status: review**.
Needs a human for final stamp: the AC requires a *live* upsert/delete against a real shared
Google calendar (PSI-062's human step — SA sees 0 calendars until calendars are shared).

What landed:
- `supabase/functions/google-calendar/push.ts` — pure logic, free of Deno/Supabase runtime imports:
  deterministic UUID-hex Google event id (`toGoogleId`), all-day-vs-timed mapper (`toGoogleEvent`,
  RRULE prefix, private `p3md_event_id` property for round-trip), and `reconcilePush`
  (op=delete; op=upsert with POST-then-PUT-on-409 idempotency, audience role/group gating,
  stale-link cleanup).
- `supabase/functions/google-calendar/push.test.ts` — 9 unit tests; 15/15 pass with sync.test.ts.
- `supabase/functions/google-calendar/index.ts` — wired real `/push` route (was a stub): method/JWT/
  JSON validation, `event_id` required, fetch event+audience+calendars+links, skip non-`app` source
  (loop prevention), upsert/delete `event_google_links` rows.
- Verified end-to-end on local Supabase: empty body → 400, nonexistent-event upsert → 404,
  delete empty-links → 200 `{ok:true,pushed:0,deleted:0}`. Full gates green: 15/15 fn tests,
  23/23 frontend, lint+tsc clean, `supabase test db` 10 files/135 pgTAP, `agent:check` ok.
- AI session recorded + rendered under PSI-066 `## AI sessions` (C-22/C-23).

## Master State

`master` is at `29f7219` (PR #44, PSI-097 AgentShield). `task/PSI-066` is ahead with `3cd9e6a`.

## Next Card

**Unblocked cards for the next session** (PSI-082 + talent phase are frozen by operator):
- **PSI-066 review stamp** — run one live upsert/delete once a calendar is shared with the SA.
- **PSI-063 · google-drive /file and /search** — `backlog`, dep of PSI-082; note deps PSI-062.
- **PSI-042 · Event form** — dep PSI-041 ✅
- **PSI-083 · Skill taxonomy admin** — depends PSI-080 ✅, but talent phase is operator-frozen.
- Cleanups (separate tasks/PRs): `git rm -r --cached obsidian-out/.obsidian/plugins` (Google cred in
  history — highest severity), `AGENTS.md` 5b, `.hermes.md` 20128>20000 trim.

## Last Commit

`3cd9e6a` — feat(google-calendar): implement /push route with idempotent event reconciliation [card: PSI-066]