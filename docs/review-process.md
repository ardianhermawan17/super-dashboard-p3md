# Review Process & `master` Branch Convention

## Branch Rule

- **Default branch is `master`** (not `main`). All task branches fork from `master`.
- Branch naming: `task/PSI-NNN` (e.g., `task/PSI-004`).
- Agents never work directly on `master`.

## Review Gate

Every task in `review` status must have a review file at `obsidian-out/review/PSI-NNN.md` before it can be merged.

### Review Document Sections

1. **Feature Summary** — Task ID, title, goal, acceptance criteria.
2. **Work Done** — Commits, files changed, implementation details.
3. **Expected Output** — Verification steps, expected results, edge cases.
4. **Verification Evidence** — Which checks passed (typecheck, lint, build, tests).
5. **Decision** — Approve / Changes requested / Blocked.

## Agent Rules (merged from Contract C-03)

1. One task per session — pick from `docs/list-task-project.md`.
2. Change only `status` and `owner` lines. Never set `done`.
3. Branch from `master`. Name: `task/PSI-NNN`.
4. Never merge without review — review file required.
5. Write a history entry per session.
6. No GCP/GCloud without explicit permission.

## Files

- Review rules: `docs/review-rules.md`
- Review documents: `obsidian-out/review/PSI-NNN.md`
- Agent conventions: `AGENTS.md` (project root)