---
updated: 2026-09-28 23:45 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-076 · Live in-app AI chat on the shared tools** — **DONE (agent scope)**, code merged into `master` at `6dfd80f` (PR #64).

What landed:
- `src/agent/models.ts`:
  - Extended provider resolver with support for `deepseek:` (`deepseek-chat`, `deepseek-reasoner`), `openrouter:` (`deepseek/deepseek-chat`, etc.), `openai-compatible:`, and `hermes:` in addition to `anthropic:` for cost-effective inference.
- `src/agent/adapters/ai-sdk.ts`:
  - Maps the 6 shared read-only agent tools (`get_board`, `get_agenda`, `get_activity`, `get_inbox`, `get_finance`, `search_documents`) into AI SDK tool definitions.
  - User context (`{ db, clientId: 'in-app' }`) guarantees queries execute with RLS permissions and log audit records to `public.agent_audit_log`.
- `src/app/api/chat/route.ts`:
  - Gated by session & `agent.chat` permission.
  - Runs `streamText` with `model(process.env.CHAT_MODEL)`, `stopWhen: stepCountIs(5)`, and system instructions grounding responses in tool outputs.
  - Returns streaming response via `result.toUIMessageStreamResponse()`.
- Interactive Chat Interface (`src/features/ai-chat/components/ai-chat-interface.tsx`):
  - Uses `DefaultChatTransport` to `/api/chat`.
  - Supports live streaming, reasoning segments, interactive tool execution badges (`ToolMarker`) showing tool name and returned payload preview, deep link citations, suggested starters, and clear chat.
  - Integrated into `/dashboard/ai-chat`.
- Unit tests:
  - `src/agent/adapters/ai-sdk.test.ts` (2 tests passing).
  - `src/agent/__tests__/models.test.ts` (5 tests passing).
  - `src/app/api/chat/__tests__/chat-route.test.ts` (3 tests passing).

## Prior Cards (this session)

- **PSI-077 · Daily digest** — **DONE** (PR #63, `5fc799b`)
- **PSI-074 · Supabase OAuth 2.1 server, consent page, resource metadata** — **DONE** (PR #59, `296a771`)
- **PSI-075 · Connected apps page** — **DONE** (PR #60, `c3a787d`)
- **PSI-078 · Verify MCP client compatibility (CIMD vs DCR)** — **DONE** (PR #61, `4dce5da`)
- **PSI-098 · Provider-agnostic LLM layer (Claude + Hermes) and evaluation** — **DONE** (PR #62, `331e556`)

## Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler)

- **PSI-096** · Hermes standing jobs: **BLOCKED** per operator instruction. All 4 jobs **paused** in scheduler (enabled=false). Nothing fires. Do not resume without explicit operator instruction.
- **PSI-077** · Daily digest uses Supabase database `pg_cron` (independent of Hermes host scheduler).

## Next Unblocked Candidate Tasks (Phase 8: Talent Search)

1. **PSI-081 · Consent and CV intake** (`onhold`, area: frontend, depends: PSI-080):
   - PDF upload to Supabase storage bucket `cvs`, parsing via `CV_MODEL`, and profile creation with consent checkbox.
2. **PSI-083 · Skill taxonomy admin** (`onhold`, area: frontend, depends: PSI-080):
   - Admin UI for managing skill taxonomy categories and synonyms.

## Human / Infra Next Actions

- **PSI-031 · Resend API key and webhook secret** (`infra`, depends PSI-011) — operator provisions Resend credentials.
- **PSI-090 · Vercel project and environments** (`infra`, depends PSI-016).
- **PSI-025 · Device QA for install and push** (`frontend`, physical mobile device QA).

## Test & Build Status

- Frontend tests: **120/120 passing** (`bun test src/`)
- Edge fns: **22/22 passing** (`bun test supabase/functions`)
- Typecheck: **clean (0 errors)** · Lint: **0 warnings / 0 errors**
- `agent:check`: **ok (86 tasks, 78 history entries)**

## Master State

- `master` @ `6dfd80f` (PR #64 merge). Working tree clean.

## Exact Next Action

Activate Phase 8 Talent Search cards (**PSI-081** / **PSI-083**).
