---
updated: 2026-09-27 06:15
project: super-dashboard-p3md-architecture
---

## Current Card

**None in progress.** PSI-073 (MCP endpoint) is implemented, committed, pushed and under review in **PR #40**.

| Item | State |
|------|-------|
| PR #40 · PSI-073 | open, needs merge to master |
| PSI-074 (next) | backlog, depends on PSI-073 |
| Last commit | `e2c6d57` on `task/PSI-073` |

## Next Card

**PSI-074 · Supabase OAuth 2.1 server, consent page, resource metadata** — blocked on PSI-073 merge.

- **AC:** Asymmetric JWT keys on; OAuth server enabled with consent URL; `/auth/consent` approve/deny works; `/.well-known/oauth-protected-resource` points to Supabase; Claude connects end to end on the hosted project.
- **area:** security · **depends:** PSI-073
- Deferred until PR #40 merges to `master`, then `git checkout master && git pull && git checkout -b task/PSI-074`.

## Last Commit

`e2c6d57` — feat(agent): MCP endpoint with mcp-handler 2.x [card: PSI-073] (on `task/PSI-073`)

## Test Status

- unit: **19/19 passed** (frontend-architecture; 3 auth-gate + 3 adapter + 13 agent)
- typecheck: 0 errors · lint: 0/0 on 299 files · next build: pass
- db reset / pgTAP: n/a for this card (no migration)
- AI Session recording: agent:check ok (75 tasks, 49 history entries); C-22 rendered note present

## In-flight Assumptions

- The 401-gate behavior (the AC's first clause) is proven by unit tests against the real route module.
- The "with a valid Supabase JWT the tools run as that user" clause is verified at the adapter boundary only; live-Supabase proof is flagged for review in PR #40.

## Unresolved Questions

- Confirm the JWKS issuer (`{project}/auth/v1`) matches the deployed Supabase project before relying on the auth gate in production.

## Exact Next Action

Once PR #40 is merged to `master`: `git checkout master && git pull && git checkout -b task/PSI-074`, read the OAuth spec and `docs/backend-architecture/agent-layer-mcp.md` §OAuth, then claim PSI-074 (backlog → doing → owner agent:hermes) and plan Supabase OAuth 2.1 server config, consent approve/deny, resource metadata, and hosted-project Claude end-to-end.
