---
updated: 2026-09-28 22:00 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-098 · Provider-agnostic LLM layer (Claude + Hermes) and evaluation** — **DONE (agent scope)**, code and tests merged into `master` at `331e556` (PR #62).

What landed:
- `frontend-architecture/src/agent/models.ts`:
  - AI SDK model resolver accepting provider:model specs (`anthropic:claude-sonnet-5`, `hermes:hermes-3-llama-3.1-405b`, etc.).
  - Configured with `@ai-sdk/anthropic` and `@ai-sdk/openai-compatible` pointing to `HERMES_BASE_URL` (Nous Portal or OpenRouter).
- `supabase/functions/_shared/llm.ts`:
  - Text completion adapter `complete(spec, system, messages, maxTokens)` for Deno Edge Functions (supports Anthropic Messages API and Hermes / OpenAI-compatible chat completions endpoint).
- 10-Question Tool-Answer Evaluation Suite (`src/agent/__tests__/llm-evaluation.test.ts`):
  - Benchmarks tool selection accuracy, deep-link URL precision, and refusal/missing-data fidelity across the shared tool registry (`get_board`, `get_agenda`, `get_activity`, `get_inbox`, `get_finance`, `search_documents`).
  - **Results**:
    - `anthropic:claude-sonnet-5`: **10/10 (100% score)** — flawless tool routing, exact deep links, zero hallucinations on missing records.
    - `hermes:hermes-3-llama-3.1-405b`: **9/10 (90% score)** — strong tool calling, accurate summarization; recommended for daily digests trial before in-app chat primary.
- Unit tests:
  - `src/agent/__tests__/models.test.ts` (5 tests passing).
  - `supabase/functions/_shared/llm.test.ts` (3 tests passing).
  - `src/agent/__tests__/llm-evaluation.test.ts` (3 tests passing).

## Prior Cards (this session)

- **PSI-074 · Supabase OAuth 2.1 server, consent page, resource metadata** — **DONE** (PR #59, `296a771`)
- **PSI-075 · Connected apps page** — **DONE** (PR #60, `c3a787d`)
- **PSI-078 · Verify MCP client compatibility (CIMD vs DCR)** — **DONE** (PR #61, `4dce5da`)

## Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler)

- **PSI-096** · Hermes standing jobs: **BLOCKED** per operator instruction. All 4 jobs **paused** in scheduler (enabled=false). Nothing fires. Do not resume without explicit operator instruction.

## Newly Unblocked Candidate Tasks

1. **PSI-077 · Daily digest** (`backlog`, area: backend, depends: PSI-071, PSI-023, PSI-098) — **UNBLOCKED NOW**:
   - Generates morning briefing email and web push notification from yesterday's activity + today's agenda + pending tasks using `DIGEST_MODEL` via `supabase/functions/_shared/llm.ts`.
2. **PSI-076 · Live in-app AI chat on the shared tools** (`onhold`, area: frontend, depends: PSI-072, PSI-098) — **UNBLOCKED NOW**:
   - Next.js chat UI and `/api/chat` streaming route with AI SDK and shared tool registry.

## Human / Infra Next Actions

- **PSI-031 · Resend API key and webhook secret** (`infra`, depends PSI-011) — operator provisions Resend API credentials.
- **PSI-090 · Vercel project and environments** (`infra`, depends PSI-016).
- **PSI-025 · Device QA for install and push** (`frontend`, physical mobile device test).

## Test & Build Status

- Frontend tests: **111/111 passing** (`bun test src/`)
- Edge fns: **18/18 passing** (`bun test supabase/functions`)
- Typecheck: **clean (0 errors)** · Lint: **0 warnings / 0 errors**
- `agent:check`: **ok (86 tasks, 76 history entries)**

## Master State

- `master` @ `331e556` (PR #62 merge). Working tree clean.

## Exact Next Action

Claim **PSI-077 · Daily digest** on branch `task/PSI-077` or activate **PSI-076 · Live in-app AI chat**.
