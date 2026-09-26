# graphify architecture

> The code-and-docs knowledge graph of this repo, built by [graphify](https://github.com/Graphify-Labs/graphify) and used by both development agents before they read files (boot step 4 in [README_AI_AGENT.md](../../README_AI_AGENT.md)). This folder keeps the dated, human-facing exports.
> Agents: [agent-operations/](../agent-operations/README.md)

## 1. Two folders, two jobs

```
graphify-out/                       # repo root · ENGINE OUTPUT · always "now" · committed
├── graph.html                      # interactive graph
├── GRAPH_REPORT.md                 # god nodes, communities, surprising links, suggested questions
├── graph.json                      # the queryable graph
└── cache/ …                        # incremental-build cache

docs/graphify-architecture/         # this folder · CURATED · dated history · committed
├── README.md                       # you are here
├── callflow.html                   # call-flow export, refreshed at phase ends
├── LESSONS.md                      # graphify reflect output
└── snapshots/
    └── 2026-10-05_phase-1.md       # copy of GRAPH_REPORT.md at the end of each phase
```

**Why `graphify-out/` is not renamed:** graphify's git hooks, its Claude Code hook and its always-on rules for every platform point at `graphify-out/` at the repo root. Renaming it breaks graph-first navigation for both agents.

## 2. Install (PSI-005)

**Per machine:** `uv tool install graphifyy` (package name has a double "y"; `pipx install graphifyy` also works).

**Per repo, for each agent:**

| Step | Claude Code | Hermes Agent |
|---|---|---|
| Skill | `graphify install --project` → `.claude/skills/graphify/` (commit) | `graphify install --platform hermes` |
| Always-on | `graphify claude install` → CLAUDE.md section + PreToolUse hook before Glob/Grep | `graphify hermes install` → rules section in `AGENTS.md` (Hermes has no tool hooks), delivered through `.hermes.md` after `bun run agent:context` |
| Full build | `/graphify .` inside Claude Code | `/graphify .` inside Hermes |
| Stricter nudging | `GRAPHIFY_HOOK_STRICT=1`: first raw file read per session is redirected to the graph | n/a |

**Shared, once:** `graphify hook install` (git hooks rebuild the graph on commit/checkout, AST only, no API cost, plus a merge driver for `graph.json`).

Use a graphify release that includes the Hermes skill-install fix; running the generic `graphify install --platform hermes` first is correct on any version.

**Proper invocation:** `/graphify .` is the skill (full build, uses the model for docs). Everything else is the CLI, which both agents run through their terminal tools: `graphify update .`, `graphify query`, `graphify path`, `graphify explain`, `graphify export`, `graphify reflect`. Only one agent runs a full `/graphify .` at a time (it rewrites `graphify-out/`); incremental `graphify update .` is cheap and runs locally.

**What gets indexed** is controlled by `.graphifyignore` at the repo root: dependencies, generated files (`graphify-out/`, `obsidian-out/`, `agent-history/entries/`, `database.types.ts`), `.hermes.md` (a generated copy) and the vendored `src/components/ui/` primitives are excluded so the graph stays about our domain.

**Privacy:** code is parsed locally with tree-sitter; docs are summarized by whichever model runs the skill. Our docs hold no secrets or personal data (C-07); if that changes, build in code-only mode.

**SQL:** `supabase/migrations/*.sql` are parsed as code, so tables, functions and policies already appear in the graph.

## 3. Refresh rules

| When | Who | Command |
|---|---|---|
| Every commit / checkout | git hook | automatic (AST only) |
| After `git pull` | whoever pulled | `graphify update .` |
| After structural code changes | the agent on the task (C-16) | `graphify update .` |
| After docs changed substantially | human, or the agent on a docs task | `/graphify . --update` |
| Weekly | Hermes cron ([hermes.md](../agent-operations/hermes.md#4-standing-jobs-cron-psi-096)) | `graphify update .`, PR if the report changed materially |
| End of each phase | human | snapshot + callflow + reflect (§4) |

## 4. Phase-end snapshot

```bash
graphify update .
cp graphify-out/GRAPH_REPORT.md "docs/graphify-architecture/snapshots/$(date +%F)_phase-N.md"
graphify export callflow-html --output docs/graphify-architecture/callflow.html
graphify reflect --out docs/graphify-architecture/LESSONS.md
git add docs/graphify-architecture && git commit -m "docs(PSI-0XX): graph snapshot phase N"
```

Diff two snapshots to see what a phase changed architecturally (new god nodes, merged communities, new cross-layer links).

## 5. Asking the graph

```bash
graphify query "what connects role mail to activity_log?"
graphify path "sendRoleMail" "mail_recipients"
graphify explain "useBoardRealtime"
```

Canonical questions, worth running at the start of related tasks:

| Area | Question |
|---|---|
| RBAC | "Which policies call has_permission and with which keys?" |
| RBAC | "What depends on effective_role_ids?" |
| Mail | "Trace a role mail from compose to delivery status" |
| Notifications | "What inserts into notifications, and what dispatches push?" |
| Google | "Which code touches the Google service account?" |
| Agent layer | "Which views do agent tools read, and are they all security_invoker?" |
| LLM | "Where is a model provider chosen, and which env vars select it?" |
| Layers | "Which frontend files call Edge Functions directly?" |

**As an MCP server** (optional, both agents): `python -m graphify.serve graphify-out/graph.json` with graphify's `mcp` extra installed; register it in each harness ([agent-operations/README.md](../agent-operations/README.md#shared-mcp-servers)).

## 6. Obsidian

The graph can also be written as notes into the local vault:

```
/graphify . --obsidian --obsidian-dir obsidian-out/graph
```

The Obsidian sync keeps `obsidian-out/graph/` untouched. See [integrated-obsidian-local.md](../integrated-obsidian-local.md).

## 7. Git policy

- Commit `graphify-out/` (graph.json, GRAPH_REPORT.md, graph.html) so every clone and both agents start with a graph.
- Ignore `graphify-out/cost.json` (per-machine token accounting).
- Commit everything in this folder; snapshots are small Markdown files.
