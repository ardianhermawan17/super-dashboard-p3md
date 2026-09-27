---
updated: 2026-09-27 06:25
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-081 · Consent and CV intake** — built on `task/PSI-081`, commit `36f70d2`, **in review**.
Needs a human: acceptance is unproven end to end (see Unresolved Questions).

What landed:

| File | What |
|------|------|
| `frontend-architecture/src/features/talent/intake.ts` | consent gate, 2 MB cap, `<user_id>/<uuid>.pdf`, Drive alternative |
| `.../talent/intake.test.ts` | 4 tests, written red first |
| `.../talent/actions.ts` | server actions; `userId` from the session, never the client |
| `.../talent/components/consent-intake-view.tsx` | consent checkbox gates both paths; reuses `FileUploader` |
| `frontend-architecture/src/app/dashboard/talent/page.tsx` | thin page |
| `frontend-architecture/src/config/nav-config.ts` | Talent nav entry (no permission gate — own CV) |
| `frontend-architecture/src/lib/supabase/database.types.ts` | regenerated — M9 was never typed |

Two fixes found while building:

1. The intake first built a **key-only** `supabase-js` client with no user. RLS on `candidates`
   requires `user_id = auth.uid()`, so the insert would have been rejected. Now uses the
   cookie-scoped server client (`@/lib/supabase/server`).
2. `database.types.ts` was **stale**: PSI-080 shipped the M9 migration without regenerating it,
   so no M9/M6/M7 table was typed. Regenerated from the local DB.

## Next Card

**PSI-082 · parse-cv Edge Function** (backend) — depends on PSI-081, now available.
Alternative if a human wants the intake finished first: wire the Drive picker (PSI-064) into
`ConsentIntakeView`, which already accepts a `driveFileId` prop.

## Last Commit

`36f70d2` — feat(talent): consent and CV intake [card: PSI-081]

Branch `task/PSI-081` is **not pushed**. `master` is untouched.

## Test Status

unit: 17 passed / 0 failed (4 new talent + 13 prior) · full suite: pass ·
typecheck: 0 errors · lint: 0 warnings 0 errors (297 files) · build: not run this card ·
acceptance: **partial** (see below) · `bun run agent:check`: ok (75 tasks, 49 history entries)

## In-flight Assumptions

- `cvs` bucket and its owner-scoped policies already exist (PSI-080 migration), so this card
  adds no migration. Verified in `supabase/migrations/20260926070000_m9_talent.sql`.
- The consent view reuses the existing generic `FileUploader`; it already defaults
  `maxSize` to 2 MB, so the cap is enforced on both client and server.
- Local dev env: `.env.local` (gitignored) now carries local Supabase CLI values
  (`http://127.0.0.1:54371` + publishable key) — added this session, previously absent.

## Unresolved Questions

1. **Acceptance cannot be closed here.** Every route 500s without `NEXT_PUBLIC_SUPABASE_URL`
   and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` — a pre-existing environment gap,
   not a card defect. `/dashboard/talent` behaves exactly like `/dashboard/kanban` and
   `/dashboard/overview` (307 → sign-in, no compile error). The authenticated upload and the
   storage write still need one manual run against the private bucket.
   Jev N/A — it cannot get past the auth gate without a test account.
2. Does the Drive pick ship now (needs PSI-064's picker) or after?
3. The `database.types.ts` regeneration rewrote 2300 lines (M9/M6/M7 + reformat). Worth a
   reviewer's eye even though typecheck is clean.

## Exact Next Action

Hand PSI-081 to a human for the one authenticated upload check: put real local Supabase keys in
`frontend-architecture/.env.local`, sign in, upload a PDF at `/dashboard/talent`, and confirm
the row in `candidates` plus an object under `cvs/<user_id>/`. Then either start PSI-082 or wire
the Drive picker.