---
updated: 2026-09-26 22:50
project: super-dashboard-p3md-architecture
---

## Current Card

**None in progress.** All four review PRs are **merged to master** this session.

| PR | Task | Merge commit |
|----|------|--------------|
| #37 | PSI-071 · M8 agent views | `1d3ccad` |
| #38 | PSI-072 · Agent tool registry | `034b181` |
| #39 | PSI-080 · M9 talent schema | `35b1e3d` |
| #36 | PSI-065 · google-calendar /sync | `b14abea` (rebased onto master — option B, no force-push) |

Board source updated: PSI-065/071/072/080 → **done** with `merged:` references.
PSI-060 stays **doing** (operator's call — 2 acceptance items still open: share a calendar with
the SA, and delete the key file).

## Master State

`master` = `origin/master` = **`cf2f145`** — clean, **zero open PRs**.

## Test Status

pgTAP: **9 files / 98 tests PASS** (`supabase test db`) · frontend unit: 13/13 ·
typecheck: clean · lint: 0 warnings 0 errors (292 files) · build: pass ·
`bun run agent:check`: ok (75 tasks, 48 history entries)

## New Contract Rule — C-22 (AI Session recording)

Added to `README_AI_AGENT.md` + Definition of Done, regenerated into `.hermes.md`.
**Why:** the old wording was satisfied by `obsidian-sync --check`, which validates but renders
nothing — so sessions looked recorded (history JSON present) while `obsidian-out/history/<id>.md`
was never generated or committed. C-22 requires: (1) the history JSON, (2) **write-mode**
`bun scripts/obsidian-sync.ts`, (3) the generated note **in the same commit**.

> **AGENTS.md rule 5b is still pending** — that file is a protected agent-instruction file, so the
> edit needs operator approval. The gateway rule already reaches Hermes via `.hermes.md`; Claude Code
> and Cursor read `AGENTS.md`, so approving that edit completes propagation.

## Next Card

**`PSI-073 · MCP endpoint with mcp-handler 2.x`** — `backlog`, dep PSI-072 ✅ done → **unblocked**.
AC: `/api/mcp` answers 401 with a resource-metadata challenge without a token; with a valid
Supabase JWT the tools list and run as that user.

Downstream: PSI-074 (OAuth 2.1 server) → PSI-075, PSI-078; PSI-076 needs PSI-098.

## Other Ready Cards

PSI-081 (Consent & CV intake, dep PSI-080 ✅) · PSI-083 (Skill taxonomy admin, dep PSI-080 ✅) ·
PSI-097 (AgentShield in CI, dep PSI-009 ✅) · PSI-096 (Hermes standing jobs ✅ deps) ·
PSI-042 (Event form, dep PSI-041 ✅).

## Human-blocked

PSI-060 (share calendar + delete key), PSI-025 (device QA), PSI-031 (Resend key), PSI-090 (Vercel),
PSI-074 (hosted Supabase OAuth config), PSI-078 (needs a real MCP client after 074).

## In-flight Assumptions / Gotchas

- `docs/list-task-project.md` is the **source of truth**; `obsidian-out/` is generated.
  A hand-edit to the vault must be mirrored into the source or it is lost on the next sync.
- The generator **strips the `✅ YYYY-MM-DD`** stamp the Kanban plugin adds; it emits `- [x] <title>`.
- `obsidian-out/.obsidian/plugins/` is gitignored, but the directory is **still tracked** (247 files) —
  gitignore does not untrack. Worth a `git rm -r --cached` card: `remotely-save/main.js` bundles a
  Google OAuth client id + secret and `obsidian-git/main.js` has committed conflict markers.
- **A local DB can silently miss a migration.** Before this session `schema_migrations` showed
  M9/M7/M6 with **M8 absent**, so `agent_layer.test.sql` failed 9/17 ("relation does not exist").
  `supabase db reset` fixed it — if a suite fails wholesale on missing relations, reset first.
- **`agent-history` schema is strict**: `verification` accepts exactly `typecheck, lint, build,
  db_reset, db_tests, manual` (`additionalProperties: false`). Extra keys fail `agent:check`.
- **`supabase db reset` may 502 at the end** — the local analytics container crash-loops against the
  Docker socket. Migrations and seed still apply; verify in psql, do not treat it as a schema failure.
- Conflict resolution for `obsidian-out/**` during a rebase: take either side, then re-run the
  write-mode sync — hand-resolving generated files is wasted work.

## Exact Next Action

Branch `task/PSI-073` from `cf2f145` and implement the MCP endpoint: claim the card (`doing` +
`owner: agent:hermes`), write the failing test for the 401 resource-metadata challenge first, then
wire `/api/mcp` through the existing `src/agent` registry from PSI-072.