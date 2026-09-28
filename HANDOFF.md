---
updated: 2026-09-28 21:00 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-078 · Verify MCP client compatibility (CIMD vs DCR)** — **DONE (agent scope)**, code and docs merged into `master` at `4dce5da` (PR #61).

What landed:
- `docs/backend-architecture/mcp-client-compatibility.md` — comprehensive client setup and compatibility guide:
  - **Claude Desktop**: Native support via RFC 7591 Dynamic Client Registration (DCR) and PKCE. Discovers `registration_endpoint` from `/.well-known/oauth-authorization-server`, registers, and prompts the user on `/auth/consent`.
  - **Hermes Agent / Custom CLI**: Native support via DCR with PKCE S256 and ES256 JWT bearer verification against Supabase JWKS.
  - **ChatGPT Actions / Custom GPTs**: Supported via pre-registered static OAuth 2.0 credentials (generated via DCR or Supabase dashboard).
  - **Cursor**: Supported via direct Bearer JWT token in MCP headers.
  - **CIMD (Client ID Metadata Documents) Analysis**: Supabase GoTrue currently expects registered client UUIDs and does not directly fetch unregistered URL-as-Client-ID documents; all major clients fall back to standard DCR when `registration_endpoint` is advertised.
- `frontend-architecture/src/agent/__tests__/mcp-client-compatibility.test.ts`:
  - 6 unit tests covering RFC 7591 payload shapes, CIMD vs DCR classification, and ES256 JWT token verification (100% pass).
- Updated `docs/backend-architecture/operations-and-risks.md` resolving the MCP spec open risk item.
- Updated `docs/backend-architecture/agent-layer-mcp.md`.

## Prior Cards (this session)

- **PSI-074 · Supabase OAuth 2.1 server, consent page, resource metadata** — **DONE** (PR #59, `296a771`)
- **PSI-075 · Connected apps page** — **DONE** (PR #60, `c3a787d`)

## Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler)

- **PSI-096** · Hermes standing jobs: **BLOCKED** per operator instruction. All 4 jobs **paused** in scheduler (enabled=false). Nothing fires. Do not resume without explicit operator instruction.

## Unblocked Next Candidates & Human Actions

1. **Human / Infra Actions**:
   - **PSI-031 · Resend API key and webhook secret** (`infra`, depends PSI-011) — operator provisions Resend API credentials.
   - **PSI-090 · Vercel project and environments** (`infra`, depends PSI-016) — operator configures production Vercel project.
   - **PSI-025 · Device QA for install and push** (`frontend`, depends PSI-022, PSI-023, PSI-024) — operator performs physical mobile PWA install & push test.

2. **Onhold / Agent Candidates**:
   - **PSI-098 · Provider-agnostic LLM layer (Claude + Hermes) and evaluation** (`backend`, depends PSI-072 — unblocked).
   - **PSI-081 · Consent and CV intake** (`frontend`, talent search module).

## Test & Build Status

- Frontend tests: **103/103 passing** (`bun test src/`)
- Edge fns: **15/15 passing**
- Typecheck: **clean (0 errors)** · Lint: **0 warnings / 0 errors**
- `agent:check`: **ok (86 tasks, 75 history entries)**

## Master State

- `master` @ `4dce5da` (PR #61 merge). Working tree clean.

## Exact Next Action

Awaiting operator direction on next task to activate (e.g. unholding **PSI-098 · Provider-agnostic LLM layer** or provisioning human infra keys for **PSI-031**).
