---
updated: 2026-09-27 12:35 WIB
project: super-dashboard-p3md-architecture
---

## Current Card

**PSI-097 · AgentShield in CI** — built on `task/PSI-097`, commit `84b9df9`, **in review** in **PR #44**.
Needs a human: the workflow has never run on a GitHub runner.

What landed:
- `.github/workflows/agentshield.yml` — first Actions workflow in the repo.
  Triggers on PRs touching `CLAUDE.md/AGENTS.md/.hermes.md/.claude/**/.mcp.json/.husky/**`
  (+ `.github/workflows/**`, + `workflow_dispatch`). Runs `npx ecc-agentshield scan --path .`
  and fails the build if `summary.critical > 0`.
- Chose the JSON-summary gate over `--gate` because `--gate` exits 0 on this tree despite
  13 high findings (baseline/score-drop semantics), so it would not implement the AC.
- Also in this branch (rule-5 continuations the operator asked for):
  - **C-23** MUST rule in `README_AI_AGENT.md` + generator now renders each session `summary`
    into the task's `## AI sessions` for human review. Regenerated `.hermes.md`.
  - Phase 8 downstreams blocked: PSI-084/085/086 (PSI-081/082 already blocked). Home: Blocked 5.

## Master State

`master` is at `25cff75` (docs(rules): C-23 + block Phase 8 downstream). `task/PSI-097` is ahead of it.

## Next Card

**Unblocked cards for the next session** (PSI-082 + talent phase are frozen by operator):
- **PSI-063 · google-drive /file and /search** — `backlog`, but it's a dep of PSI-082; note deps PSI-062.
- **PSI-066 · google-calendar /push** — dep PSI-065 ✅
- **PSI-042 · Event form** — dep PSI-041 ✅
- **PSI-083 · Skill taxonomy admin** — depends PSI-080 ✅, but talent phase is operator-frozen.
- Cleanups (separate tasks/PRs): `git rm -r --cached obsidian-out/.obsidian/plugins` (Google cred in
  history — highest severity), `AGENTS.md` 5b.

## Last Commit

`84b9df9` — ci(security): AgentShield on PRs touching agent config [card: PSI-097]

## Test Status

AgentShield real scan: 121 findings (0 critical, 13 high, 71 med, 37 low) — gate passes.
`bun run agent:check` ok (83 tasks, 57 history entries). Frontend gates (no source changed): lint 0/0, tsc 0, 23/23 test.
`.hermes.md` is 20,128 chars — **128 over the 20,000 soft-limit**; `agent:context` warns, does not fail. Trim AGENTS.md to fix (needs operator approval; protected file).

## In-flight Assumptions

- The AgentShield workflow will need network on the runner for `npx ecc-agentshield`.
- `.gitignore` does not untrack `obsidian-out/.obsidian/plugins/` — still 247 tracked files incl.
  `remotely-save/main.js` with a bundled Google OAuth id+secret (gitignore only prevents new adds).

## Unresolved Questions

1. **PSI-097 CI run** — open a PR touching an agent-config path or trigger `workflow_dispatch`
   to confirm the job is green, then operator stamps review → done (C-21).
2. **PSI-094** (pre-launch security review, human-owned) depends on PSI-086 (now blocked); it also
   deps PSI-074 + PSI-063. Decide keep backlog or block.
3. **`.hermes.md` over 20k** — trim AGENTS.md (needs your approval; protected file).
4. Freeze semantics on the blocked cards — confirm `blocked` is preferred over `backlog`(see prior session).

## Exact Next Action

Review + merge **PR #44** (PSI-097). Then either: operator approves trimming AGENTS.md (clears the
`.hermes.md` soft-limit), or agent takes **PSI-063** (Google-Drive /file,/search, dep PSI-062) — check
PSI-062's status first — or the credential untrack cleanup as its own task/PR.