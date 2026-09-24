# Hermes Agent (operator lane)

> Setup, security and standing jobs for Nous Research's Hermes Agent in this repo, plus its per-task flow when it builds.
> Lanes and coordination: [README.md](README.md) · ECC details: [ecc.md](ecc.md) · Contract: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## 1. Install (per machine or server)

1. Install Hermes following Nous Research's docs, then `hermes setup` and choose the model provider (Nous Portal, OpenRouter, Anthropic, …). Hermes can switch providers with `hermes model`; record whatever actually ran in the history entry's `agent.model`.
2. **Security first**, before connecting any chat platform:
   - Messaging gateway (Telegram/Slack): DM pairing on, command approval on. The gateway is a remote shell into this repo.
   - Terminal backend: local is fine for this trusted repo; use the Docker backend when Hermes runs code from anywhere else.
   - Never put the Supabase secret key, the Google service-account key or Resend keys in `~/.hermes/config.yaml` or `.env` files Hermes reads (C-04, C-18).
3. **ECC for Hermes** (skills only; the Hermes adapter is minimal/experimental in ECC's support matrix):
   ```bash
   git clone https://github.com/affaan-m/ECC.git && cd ECC
   ./install.sh --profile minimal --target hermes
   ```
4. **graphify for Hermes:**
   ```bash
   graphify install --platform hermes     # installs the graphify skill for Hermes
   cd <repo> && graphify hermes install   # writes graphify's always-on rules into AGENTS.md
   ```
   Hermes has no tool hooks, so those AGENTS.md rules are its graph-first mechanism, and they only reach Hermes through `.hermes.md` (§2). Use a graphify release that includes the Hermes skill-install fix; running `graphify install --platform hermes` first covers older releases.
5. **MCP:** add the graphify server and, for staging, this app's `/api/mcp` with `hermes mcp` (Hermes handles the OAuth 2.1 PKCE flow for remote servers).

## 2. Project context: `.hermes.md`

Hermes reads exactly one project context file, first match wins: `.hermes.md` → `AGENTS.override.md` → `AGENTS.md` → `CLAUDE.md` → `.cursorrules`. It does not expand `@` imports. So this repo ships a **generated** `.hermes.md`:

```bash
bun run agent:context          # writes .hermes.md = README_AI_AGENT.md + AGENTS.md
bun run agent:check            # fails if .hermes.md is stale or missing
```

- Committed, never hand-edited (the file says so in its first line).
- Regenerate after editing `README_AI_AGENT.md` or `AGENTS.md`, and after `graphify hermes install` (it changes AGENTS.md).
- Because `.hermes.md` wins, a personal `AGENTS.override.md` is **not** read in this repo; personal style belongs in Hermes' own `SOUL.md` / `USER.md`.
- Size budget: the generator warns above 20,000 characters, Hermes' minimum truncation cap.

## 3. Invoking skills

Hermes calls skills as `/<skill-name>`:

| Need | In Hermes |
|---|---|
| Build or refresh the graph | `/graphify .` (full build) · `graphify update .` via the terminal tool (incremental) |
| Ask the graph | `graphify query "<question>"` via the terminal tool |
| Research before coding | `/search-first` (ECC skill, if imported) |
| Security pass on a change | `/security-review` (ECC skill, if imported) |
| See what is installed | `/skills` |

The `/ecc:…` command namespace exists only in Claude Code's plugin; in Hermes use skill names. Context pressure: `/compress`, `/usage`.

## 4. Standing jobs (cron, PSI-096)

Hermes' scheduler runs these with delivery to Telegram/Slack. All are read-only except the graph job, which only opens a PR.

| Job | Schedule (WIB) | Does | Writes |
|---|---|---|---|
| Morning pulse | Weekdays 07:00 | `git pull`; summarize `doing`, `review`, `blocked` tasks and history entries with `human_review.required` | Nothing |
| Contract check | Daily 22:00 | `git pull && bun run agent:check`; report failures verbatim | Nothing |
| Weekly graph | Sunday 21:00 | `graphify update .`; if `GRAPH_REPORT.md` changed materially, push `agent/PSI-005-graph-refresh-<date>` and open a PR | Branch + PR only |
| Stale work | Monday 08:00 | Tasks `doing` for more than 3 days with no history entry since | Nothing |

Cron runs are sessions too: a job that changed files writes a history entry; read-only jobs don't.

## 5. When Hermes builds (per-task flow)

Same contract as any agent:

1. Boot: the contract is in context via `.hermes.md`; read the task and its earlier history entries.
2. Claim: `status: doing`, `owner: agent:hermes`, branch `agent/PSI-0XX-slug`.
3. Orient with `graphify query`, then work. Run the DoD commands through the terminal tool.
4. Human gates (C-15): ask in the chat thread; quote the explicit "yes" in the history entry's `decisions`.
5. Record: history entry with `agent.name: hermes` and the real provider/model in `agent.model`; `bun run agent:check`; `status: review`.

**Skills Hermes creates** from experience stay in `~/.hermes/skills/`. If one is worth sharing, open a PR that adds it under `.agents/skills/`; a human reviews it before merge (C-20).
