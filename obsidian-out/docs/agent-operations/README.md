# Agent operations: Claude Code + Hermes Agent

> How the two development agents share this repo under one contract. Claude Code is the default **builder**, Hermes Agent the default **operator**; both run ECC and graphify, both write agent-history entries.
> Contract: [README_AI_AGENT.md](../../README_AI_AGENT.md) · Tooling: [ecc.md](ecc.md), [graphify-architecture/](../graphify-architecture/README.md)

## Files in this folder

| File | Read it when |
|---|---|
| [claude-code.md](claude-code.md) | Setting up or working in Claude Code (CLAUDE.md, ECC plugin, graphify hooks, per-task commands) |
| [hermes.md](hermes.md) | Setting up or working in Hermes (`.hermes.md`, gateway security, cron jobs, skills) |
| [ecc.md](ecc.md) | Installing ECC per harness, which ECC command or skill to use when, AgentShield, Memory Vault |
| [../graphify-architecture/README.md](../graphify-architecture/README.md) | Building and querying the code graph from either agent |

## Lanes

| | Claude Code + ECC | Hermes Agent + ECC skills |
|---|---|---|
| Default role | **Builder** | **Operator** |
| Front door | Terminal / IDE on a dev machine | CLI/TUI, Telegram or Slack gateway, cron (dev machine or a small server) |
| Default work | Implementing tasks: code, migrations, tests, reviews | Triage, research, backlog grooming, status reports, scheduled checks, docs, small fixes |
| Typical task areas | `frontend`, `backend`, `db`, `integration`, `security` | `docs`, `agent-ops`, `infra`, research spikes |
| `agent.name` in history | `claude-code` | `hermes` |
| Graph-first mechanism | graphify skill + PreToolUse hook | graphify skill + always-on rules (inside `.hermes.md`) |

**Why this split:** ECC's full feature set (plugin commands, hooks, sub-agents) is stable on Claude Code and only minimal/experimental on Hermes, so reviewed code changes go through Claude Code by default. Hermes is strongest where Claude Code isn't: always on, reachable from a phone, scheduled jobs, persistent memory, any model provider.

The lanes are defaults, not walls: either agent may take any task under the same contract. What is never allowed is two agents on one task or one branch (C-03).

## One contract, three delivery paths

```
README_AI_AGENT.md  (contract)  ─┐
AGENTS.md  (template conventions + graphify always-on rules)
                                 ├─▶ Claude Code : CLAUDE.md starts with  @README_AI_AGENT.md  and  @AGENTS.md
                                 ├─▶ Hermes      : .hermes.md = generated copy of both (bun run agent:context)
                                 └─▶ Codex, Cursor, others : AGENTS.md line 1 points to README_AI_AGENT.md
```

**Why Hermes gets a generated file:** Hermes loads exactly one project context file per session, first match wins (`.hermes.md` → `AGENTS.override.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`), and it does not expand `@` imports inside context files. A generated `.hermes.md` puts the contract *and* the template conventions *and* graphify's rules into Hermes' system prompt. `bun run agent:context` regenerates it; `bun run agent:check` fails when it is stale. Keep the combined size under ~20,000 characters (Hermes' minimum truncation cap).

## Handoffs

1. **Governed (required):** the task list and the history entry. The finishing agent sets `status: review`, writes `follow_ups`, and the next agent reads both at boot. This is the record.
2. **Scratchpad (optional):** ECC Memory Vault, e.g. `ecc memory handoff --from hermes --target claude … --stdin`. Unreviewed context only; never a substitute for the history entry; never secrets or personal data ([ecc.md](ecc.md#memory-vault-optional-handoffs)).

Typical loop:

```
Ficana (Telegram) → Hermes: "users want a reset button for the ICS link"
Hermes   → appends PSI-1xx to the task list (backlog, owner: human), replies with the ID
Ficana   → moves it to todo
Claude Code → claims, /ecc:plan, tdd-workflow, /ecc:code-review, history entry, status: review
Hermes (07:00 cron) → "PSI-1xx is in review; 1 session needs your review" → Ficana merges, sets done
```

## Coordination rules (in addition to the contract)

- **One owner per task** (C-03): `owner: agent:claude-code` or `owner: agent:hermes`. Check the owner line before starting; a `doing` task owned by the other agent is off limits.
- **One branch per task**: `agent/PSI-0XX-slug`. Agents never commit to each other's branches or to `main`.
- **Human gates travel through chat:** when C-15 triggers in Hermes, the approval request goes to Telegram/Slack; an explicit "yes" from Ficana is the approval, and the history entry quotes it in `decisions`.
- **The Hermes gateway is a remote shell:** DM pairing and command approval stay on; production deploys, `supabase db push` and anything under C-15 are never triggered from chat without that explicit approval.
- **No production secrets in agent config:** `~/.hermes/config.yaml`, `~/.claude/settings.json`, `.mcp.json` never hold the Supabase secret key, the Google service-account key or Resend keys (C-04, C-18).
- **Memories are not facts** (C-20): Hermes `MEMORY.md`/`USER.md`, ECC instincts and Memory Vault, Claude auto-memory can be stale. Project facts come from the repo docs and agent history.
- **Self-made skills stay out of the repo** until reviewed: Hermes' learned skills and ECC `/skill-create` / `/learn-eval` output live in the agent's home directory; moving one into the repo is a PR a human approves.

## Shared MCP servers

| Server | Used by | Scope |
|---|---|---|
| graphify (`python -m graphify.serve graphify-out/graph.json`, needs the `mcp` extra) | both | Read-only graph queries |
| This app's `/api/mcp` | both (Hermes connects with OAuth 2.1 PKCE) | Read-only app data; point dev agents at local or staging, never production |
| Supabase MCP (optional) | Claude Code | Local or a dev project, read-only; never production |

Register servers per harness (`/mcp` or `.mcp.json` in Claude Code, `hermes mcp` in Hermes). A new MCP server in the repo config is an agent-config change: run AgentShield ([ecc.md](ecc.md#agentshield)).
