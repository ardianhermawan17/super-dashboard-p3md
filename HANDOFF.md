---
updated: 2026-09-27 09:50 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**None in progress.** PRs #40 (PSI-073), #41 (PSI-100) and #42 (PSI-081) are merged to `master`, in that order.
All three cards stay in **review** until the operator stamps them on the board (C-21).

| Card | PR | State after merge |
|------|----|-------------------|
| PSI-073 · MCP endpoint with mcp-handler 2.x | #40 | review: 401 gate unit-tested; "tools run as that user" proven at the adapter boundary only |
| PSI-100 · Event finance design (Phase 10 plan) | #41 | review: docs only; PSI-101…106 in backlog |
| PSI-081 · Consent and CV intake | #42 | review: **acceptance partial**, needs one authenticated upload check |

## Next Card

- **PSI-074 · Supabase OAuth 2.1 server, consent page, resource metadata** (security): unblocked now that PSI-073 is on `master`.
  AC: asymmetric JWT keys on; OAuth server enabled with consent URL; `/auth/consent` approve/deny works; `/.well-known/oauth-protected-resource` points to Supabase; Claude connects end to end on the hosted project.
- **PSI-082 · parse-cv Edge Function** (backend): depends on PSI-081. Alternative if the intake should be finished first: wire the Drive picker (PSI-064) into `ConsentIntakeView`, which already accepts a `driveFileId` prop.
- **PSI-101 · Migration M10 finance**: backlog until the operator moves it to todo; spec in `docs/database-architecture/m10-finance.md`.

## Test Status (per card, before merge)

- PSI-073: unit 19/19 (3 auth-gate + 3 adapter + 13 agent) · typecheck 0 · lint 0/0 · next build pass
- PSI-081: unit 17/17 (4 talent + 13 prior) · typecheck 0 · lint 0/0 · build not run · acceptance partial
- PSI-100: docs only · agent:check ok
- Combined `master` after the three merges: see the merge history entry.

## In-flight Assumptions

- PSI-073: the 401 gate is proven by unit tests against the real route module; live-Supabase proof of per-user tool runs is still open.
- PSI-081: the `cvs` bucket and its owner-scoped policies come from M9 (`20260926070000_m9_talent.sql`); no new migration. `FileUploader` defaults `maxSize` to 2 MB, so the cap holds on client and server.
- PSI-081 regenerated `database.types.ts` (M6/M7/M9 were never typed; ~2300 lines changed).

## Unresolved Questions

1. **PSI-073:** confirm the JWKS issuer (`{project}/auth/v1`) matches the deployed Supabase project before relying on the MCP auth gate in production.
2. **PSI-081:** acceptance needs one manual run: put real local Supabase keys in `frontend-architecture/.env.local`, sign in, upload a PDF at `/dashboard/talent`, confirm the `candidates` row and an object under `cvs/<user_id>/`.
3. **PSI-081:** does the Drive pick ship now (needs PSI-064's picker) or later?
4. **PSI-100:** the M10 migration changes the existing `activity_log` select policy (so finance amounts do not leak to board members without `finance.read`); that PR needs human review (C-15).

## Exact Next Action

`git checkout master && git pull`. Operator: stamp PSI-073, PSI-081, PSI-100 (or send back). Agent: claim PSI-074 or PSI-082 (backlog → doing, own branch `task/PSI-0XX`).
