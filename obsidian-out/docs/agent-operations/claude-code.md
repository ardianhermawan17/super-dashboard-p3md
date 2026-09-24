# Claude Code (builder lane)

> Setup and the per-task command flow for Claude Code with ECC and graphify.
> Lanes and coordination: [README.md](README.md) · ECC details: [ecc.md](ecc.md) · Contract: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## 1. Per machine (once)

```
# inside Claude Code
/plugin marketplace add https://github.com/affaan-m/ECC
/plugin install ecc@ecc
```

```bash
uv tool install graphifyy          # graphify CLI (package name has a double "y")
```

Pick **one** ECC install method for Claude Code: the plugin above. Never also run ECC's `./install.sh --profile full` into Claude Code (stacked installs duplicate hooks and commands).

## 2. Per repo (committed, PSI-004 / PSI-005 / PSI-009)

**`CLAUDE.md`**: the first two lines import the contract and the shared conventions; the template's own content stays below.

```
@README_AI_AGENT.md
@AGENTS.md
```

**ECC rules, project-local** (plugins cannot ship rules; keep them in the repo so every clone behaves the same):

```bash
git clone https://github.com/affaan-m/ECC.git /tmp/ecc
mkdir -p .claude/rules/ecc
cp -R /tmp/ecc/rules/common .claude/rules/ecc/
cp -R /tmp/ecc/rules/typescript .claude/rules/ecc/
```

Rules load into every session, so only `common` + `typescript`. Where they disagree with our docs, the contract wins (C-19; known overlaps in [ecc.md](ecc.md#rules-and-precedence)).

**graphify**:

```bash
graphify install --project          # skill → .claude/skills/graphify/ (commit it)
graphify claude install             # CLAUDE.md section + PreToolUse hook: graph before grep/glob
graphify hook install               # git hooks: rebuild on commit/checkout (AST only, no API cost)
```

Then, once, inside Claude Code: `/graphify .` to build `graphify-out/`.

Optional: `GRAPHIFY_HOOK_STRICT=1` makes the hook block the first raw file read of a session and redirect to the graph (fires at most once per session).

**Verify the agent config** after any of the above: `npx ecc-agentshield scan --path .` (or `/ecc:security-scan`).

## 3. Per task: the contract mapped to commands

| Contract step | In Claude Code |
|---|---|
| Boot (gateway §2) | Contract and conventions are already loaded via `CLAUDE.md`. Read the task, then earlier history: `ls agent-history/entries \| grep PSI-0XX` |
| Orient | `graphify query "<question>"`, or `graphify path A B`, `graphify explain X`; read `graphify-out/GRAPH_REPORT.md` for architecture questions |
| Claim (C-03) | Set `status: doing`, `owner: agent:claude-code`; branch `agent/PSI-0XX-slug` |
| Plan | `/ecc:plan "PSI-0XX <title>. Accept: <accept line>"` → approve or edit (Plan Canvas) before any code |
| Build | `tdd-workflow` skill: failing test first, then implementation |
| Review | `/ecc:code-review` (fresh context). Migrations also get the `database-reviewer` agent; auth, RLS or Google code also gets `security-reviewer` |
| Fix a broken build | `/ecc:build-fix` |
| Verify (gateway §6) | `/ecc:quality-gate`, then the DoD commands: `bunx tsc --noEmit`, `bun run lint`, `bun run build`, `supabase db reset`, `supabase test db` |
| Docs touched by the change | `/ecc:update-docs`, then check the doc still follows its folder's placement rule |
| Graph | `graphify update .` after structural changes (C-16) |
| Record | History entry (`agent.name: claude-code`, real `model`), `bun run agent:check`, `bun run obsidian:sync`, `status: review` |

Long sessions: `/ecc:context-budget` when context is tight; `/ecc:save-session` before stopping mid-task and `/ecc:resume-session` to continue. Confirm the installed surface with `/plugin list ecc@ecc`: plugin commands carry the `/ecc:` prefix, skills are invoked by name.

## 4. Hooks living together

Claude Code will run ECC's plugin hooks and graphify's PreToolUse hook side by side; that is expected. If hooks add too much latency or context, lower ECC with `ECC_HOOK_PROFILE=minimal` before removing anything. Never copy ECC's `hooks/hooks.json` into `settings.json` when using the plugin (it double-fires).
