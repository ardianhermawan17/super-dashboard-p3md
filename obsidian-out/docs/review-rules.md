# Review Process Rules

> All agent work goes through review before merge. Humans review and set tasks to `done`.

## Branch Rule

- **Default branch is `master`** (not `main`). All new tasks branch from `master`.
- Branch naming: `task/PSI-NNN` (e.g., `task/PSI-004`).

## What a Review File Must Contain

Every review document lives in `obsidian-out/review/PSI-NNN.md` and must include:

### 1. Feature Summary
- **Task ID & Title** — e.g., `PSI-001 · Fork template`
- **Goal** — One sentence describing what was built or changed.
- **Acceptance Criteria** — Copy from `docs/list-task-project.md`.

### 2. Work Done
- **Commits** — Key commit hashes and messages.
- **Files changed** — List of added/modified/deleted files.
- **Implementation details** — What the agent actually did, in bullet points.

### 3. Expected Output
- **Verification steps** — Commands the reviewer can run to confirm it works.
- **Expected result** — What `bun run dev`, `bun run build`, `supabase db reset`, etc. should output.
- **Edge cases** — Any known limits or things that still need human attention.

### 4. Verification Evidence
- Which checks passed (typecheck, lint, build, tests).
- Screenshots or logs if applicable.
- Any deviations from the accept line, with justification.

### 5. Decision
- `[ ] Approve — move to done`
- `[ ] Changes requested — return to doing with notes`
- `[ ] Blocked — reason noted`

## Review Cadence

| Who | Does |
|---|---|
| Agent | Does the work, writes the review file, moves task to `review` |
| Agent (second) | Reads the review file, runs verification, either approves or requests changes |
| Human | Final sign-off: sets task to `done` on `master` |

## Rules

1. **Agents never set `done`.** Only a human does after reviewing.
2. **Agents never merge into `master` without a review.** All merges go through review first.
3. **One task per branch.** Never stack multiple tasks on one branch.
4. **Review files are written by the implementer** at the end of the session.
5. **A review file must exist** for every task in `review` status. No file means incomplete.