# Review Protocol & Obsidian Review Workflow

> **Mandatory Rule for AI Agents** (Claude Code, Hermes Agent, Cursor, etc.) when reviewing tasks or moving tasks into `review` status.

---

## 1. Core Rule

Whenever an AI agent is instructed to **review a task** (e.g., *"review PSI-002"*) or is finishing work on a task:

1. **Always checkout the task branch** (`task/PSI-NNN`) and **rebase onto `master`**.
2. **Always create / update the Obsidian review file** at `obsidian-out/review/PSI-NNN.md`.
3. **Always document the agent's historical work**, key decisions, implementation details, expected output, and verification runbook.
4. **Always run `obsidian:sync`** to verify the vault updates cleanly without errors.

---

## 2. Step-by-Step Review Procedure

```
1. git checkout task/PSI-NNN ──▶ 2. git rebase master ──▶ 3. Inspect history & diff
       │
       ▼
4. Write obsidian-out/review/PSI-NNN.md ──▶ 5. bun scripts/obsidian-sync.ts ──▶ 6. Report to user
```

### Step 1: Git Branch Checkout & Rebase
```bash
git fetch origin
git checkout task/PSI-NNN
git rebase master
```
- Never perform review work directly on `master`.
- Ensure the task branch is rebased cleanly on top of `master` before creating the review document.

### Step 2: Extract Historical Agent Work
- Read the corresponding session history file in `agent-history/entries/*PSI-NNN*.json`.
- Read the task definition in `docs/list-task-project.md`.
- Inspect git commits: `git log master..HEAD --oneline` and `git diff master...HEAD --stat`.

### Step 3: Generate the Obsidian Review Document
Create `obsidian-out/review/PSI-NNN.md` with the standard Obsidian Kanban review template.

---

## 3. Standard Review Document Template (`obsidian-out/review/PSI-NNN.md`)

```markdown
---
kanban-plugin: basic
tags:
  - review
  - p3md
  - phase-X
  - PSI-NNN
created: YYYY-MM-DD
updated: YYYY-MM-DD
task: PSI-NNN
title: "Exact task title"
status: review
owner: "agent:<name>"
target_branch: master
---

# Review: PSI-NNN · Exact task title

> **Task ID:** `PSI-NNN`  
> **Status:** `review`  
> **Owner:** `agent:<name>`  
> **Source Definition:** `docs/list-task-project.md:LINE`  
> **Obsidian Task Note:** [[tasks/PSI-NNN|PSI-NNN Note]]  
> **Obsidian Board:** [[Board]]

---

## 1. Feature Summary & Goal

- **Objective:** One sentence describing what was built, refactored, or fixed.
- **Contract Acceptance Criteria:**
  > Exact `accept:` line copied from `docs/list-task-project.md`.

---

## 2. Agent Historical Work & Implementation

### A. Agent Execution History
- Document which agents worked on the task (e.g. `claude-code`, `hermes`, human).
- Reference the session IDs in `agent-history/entries/`.

### B. Summary of Changes
- Total files added, modified, deleted.
- Exact breakdown of major code changes and architecture touched.

---

## 3. Key Decisions & Rationale

| Decision | Rationale | Alternatives Considered |
|---|---|---|
| Main architectural decision | Why this approach was chosen | Other options rejected |

---

## 4. Expected Output & Verification Runbook

### Verification Commands (Windows 11 / POSIX Bash)

```bash
# 1. Typecheck / Build / Test
bun run typecheck
bun run lint
bun run build
bun run dev
```

### Expected Results
- Exact expected terminal outputs, HTTP status codes, and UI behavior.

---

## 5. Known Boundaries & Dependent Follow-ups

| Boundary / Observed Behavior | Target Task / Phase |
|---|---|
| Features intentionally deferred or stubbed | Downstream task ID |

---

## 6. Review Checklist & Sign-off

- [x] Code verified and builds cleanly with 0 errors
- [x] Acceptance criteria fully satisfied
- [ ] **Human Sign-off:** Change status in `docs/list-task-project.md` from `status: review` to `status: done`
```

---

## 4. Step 4: Vault Synchronization

After creating or editing `obsidian-out/review/PSI-NNN.md`, execute:

```bash
bun scripts/obsidian-sync.ts
# or
npx --yes bun scripts/obsidian-sync.ts
```

Confirm that the script outputs `obsidian-sync: ... files updated` with `0 problems`.

---

## 5. Board = Source of Truth (Contract C-21)

> Read this before writing any review card. It changes what `review` and `done` mean.

**A task is stamped `done` only when the operator does it.** The agent never sets or un-stamps `done`. Concretely, the marker of a stamped `done` is one of:

- the board shows `- [x] [[tasks/PSI-NNN|PSI-NNN]] <title> … ✅ YYYY-MM-DD` in the **Done** section, **or**
- `docs/list-task-project.md` reads `- status: done` for that task.

**What an agent may do:**

| Status | Who sets it | Meaning |
|---|---|---|
| `backlog` / `todo` | anyone | Planned / ready, nobody claimed |
| `doing` | the agent claiming it (C-03) | Work in progress, one agent owns it |
| `review` | the agent finishing work | Done building, waiting for the operator |
| `blocked` | the agent (with C-15 reason) | Needs a human decision |
| `done` | **only the operator's stamp** | Signed off |

**The mirror rule:** after the operator stamps a card, `docs/list-task-project.md` is changed to `status: done` **to match the board** — never the other way around. The review card is written as a *record of completion* (frontmatter `status: done`), not as a pending checkpoint.

### Worked example — PSI-012

1. Agent (claude-code) built the M1 RBAC migration, wrote `scripts/db-review/psi012-verify.sql`, proved all 17 checks on live Postgres.
2. Agent wrote `obsidian-out/review/PSI-012.md` with the full history + runbook and set the task to `review`.
3. **The board shows PSI-012 in `## Review` as `- [ ]` (unstamped).**
4. → **PSI-012 is NOT done.** It stays `review` until the operator stamps it in Obsidian (moves it to Done / checks the box).
5. Only after that stamp is `docs/list-task-project.md` mirrored to `status: done` and the card frontmatter to `status: done`.

**An agent must never:** flip `review → done` itself, mark a card `[x]` in the board source, or un-stamp a done task. If the operator wants a done task re-opened, they move it back to `review` (or say so in the thread).
