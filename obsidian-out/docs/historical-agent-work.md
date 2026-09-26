# Historical agent work

> The JSON contract for recording what AI agents actually did, session by session. It is the audit trail behind the task list and the feed for the Obsidian AI work log.
> Schema: [agent-history/schema.json](../agent-history/schema.json) · Board and log: [integrated-obsidian-local.md](integrated-obsidian-local.md) · Gateway: [README_AI_AGENT.md](../README_AI_AGENT.md)

## 1. Why this exists

The task list says **what should happen**. Git says **which lines changed**. Neither says what an agent intended, what it verified, what it decided and what it left behind. That gap is where AI-assisted projects lose track. Every agent session therefore ends with one JSON entry that a machine can validate and a human can read.

## 2. Where entries live

```
agent-history/
├── schema.json                        # the contract (JSON Schema 2020-12)
└── entries/
    ├── 2026-09-23T01-54-29Z__PSI-003__claude-chat.json
    ├── 2026-10-02T07-15-00Z__PSI-032__claude-code.json
    └── 2026-10-02T09-40-00Z__PSI-096__hermes.json
```

- **One file per session**, never a shared log file. Parallel branches and agents never produce merge conflicts.
- **File name = `id` + `.json`**. The `id` is `<started_at UTC, ':' → '-'>__<first task ID>__<agent name>`, so `ls` sorts entries chronologically.
- Entries are committed on the same branch as the work they describe.

## 3. Rules (contract C-12, C-13, C-14)

1. **Always write one.** Every session that touched the repo writes exactly one entry before stopping, including sessions that failed or were abandoned, whichever agent ran it (Claude Code, Hermes, or a Hermes cron job that changed files). Failed sessions are the most useful ones to read later.
2. **Append-only.** Never edit or delete an entry, not even your own from five minutes ago. To correct one, write a new entry with `"supersedes": "<old id>"`.
3. **Truthful verification.** `pass` or `fail` only for checks you actually ran in this session. Not run but should have been → `skipped`. Not relevant to the change (e.g. no DB touched) → `n/a`.
4. **Truthful outcome.** `done` only when every `accept:` criterion of the task is met. Otherwise `partial`, `blocked` (waiting on a human or external thing) or `abandoned` (approach dropped).
5. **No secrets, no personal data** (C-07, C-08). No keys, tokens, emails, phone numbers, CV text or real names other than the operator. Describe data, don't paste it.
6. **Cite deviations.** If you broke a contract rule for a reason, record it in `contract_deviations` with the rule ID. Silence is worse than a documented deviation.
7. **Out-of-scope findings go to `follow_ups`**, with an existing task ID or `NEW`.
8. **Validate before committing:** `bun run agent:check`.

## 4. Fields

| Field | Req. | Type | Meaning |
|---|---|---|---|
| `schema_version` | ✓ | `"1.0"` | Contract version |
| `id` | ✓ | string | See §2; must equal the file name |
| `task_ids` | ✓ | `PSI-###`[] | Tasks this session worked on (normally one, C-01) |
| `agent.name` | ✓ | slug | The harness: `claude-code`, `hermes`, `codex`, `cursor`, `claude-chat`, … |
| `agent.model` | | string | The model that actually ran, preferably `provider:model` (e.g. `anthropic:claude-sonnet-5`, `openrouter:<hermes model id>`); Hermes can switch providers, so record the real one |
| `agent.operator` | ✓ | string | The human accountable for the session |
| `session.started_at` / `ended_at` | ✓ | ISO 8601 | With offset or `Z` |
| `session.branch` / `commits` | | string / sha[] | Where the work lives |
| `intent` | ✓ | ≤ 200 chars | What the session set out to do |
| `outcome` | ✓ | enum | `done` · `partial` · `blocked` · `abandoned` |
| `summary` | ✓ | ≤ 2000 chars | What actually happened, including what did not work |
| `changes[]` | ✓ | `{path, action, note?}` | Files touched; `action` is `added` · `modified` · `deleted` · `renamed` |
| `decisions[]` | | `{decision, reason, alternatives?}` | Choices a future reader would question |
| `verification` | ✓ | object | `typecheck`, `lint`, `build`, `db_reset`, `db_tests` ∈ `pass` · `fail` · `skipped` · `n/a`, plus `manual` (free text) |
| `migrations[]` | | path[] | New migration files |
| `dependencies_added[]` | | `{name, version, reason}` | Contract C-10 |
| `contract_deviations[]` | | `{rule, why}` | `rule` like `C-05` |
| `risks[]` | | string[] | What might break |
| `follow_ups[]` | | `{task_id?, note}` | `task_id` is `PSI-###` or `NEW` |
| `human_review` | ✓ | `{required, reason?}` | `true` whenever C-15 applied or anything is uncertain |
| `supersedes` | | id | The entry this one corrects |

`additionalProperties` is `false` everywhere: unknown fields fail validation instead of silently drifting.

## 5. Example entry

```json
{
  "$schema": "../schema.json",
  "schema_version": "1.0",
  "id": "2026-10-02T07-15-00Z__PSI-032__claude-code",
  "task_ids": ["PSI-032"],
  "agent": { "name": "claude-code", "model": "claude-sonnet-5", "operator": "ficana" },
  "session": {
    "started_at": "2026-10-02T07:15:00Z",
    "ended_at": "2026-10-02T08:02:41Z",
    "branch": "agent/PSI-032-send-role-mail",
    "commits": ["4f2c9ab", "91d03e7"]
  },
  "intent": "Implement the send-role-mail Edge Function with an idempotent claim and batched sends.",
  "outcome": "partial",
  "summary": "Function implemented per backend-architecture/edge-functions.md and works locally against a Resend test key. The 409-on-second-call path is verified. Batch response ids could not be confirmed against a real multi-recipient send because the seeded role has one member.",
  "changes": [
    { "path": "supabase/functions/send-role-mail/index.ts", "action": "added" },
    { "path": "supabase/functions/_shared/json.ts", "action": "added", "note": "json() response helper" }
  ],
  "decisions": [
    {
      "decision": "Send one email per recipient instead of a single BCC email",
      "reason": "Per-recipient delivery status and no address leakage",
      "alternatives": ["BCC to all role members"]
    }
  ],
  "verification": {
    "typecheck": "pass",
    "lint": "pass",
    "build": "pass",
    "db_reset": "pass",
    "db_tests": "skipped",
    "manual": "POST from compose with a seeded sender; second POST returned 409"
  },
  "dependencies_added": [],
  "risks": ["BATCH_SIZE assumes Resend's current per-request cap"],
  "follow_ups": [
    { "task_id": "PSI-036", "note": "Seed a role with 3 members for the multi-recipient smoke test" },
    { "task_id": "NEW", "note": "Move batching into _shared/send.ts before PSI-043 reuses it" }
  ],
  "human_review": { "required": true, "reason": "Outcome partial; needs a real multi-recipient send" }
}
```

## 6. Writing an entry (agents)

```bash
# 1. id from the session start time (UTC)
START="2026-10-02T07:15:00Z"
ID="$(echo "$START" | tr ':' '-')__PSI-032__claude-code"

# 2. write agent-history/entries/$ID.json (copy §5, replace every value)

# 3. validate, then regenerate the Obsidian log
bun run agent:check
bun run obsidian:sync
```

## 7. Reading history (humans and agents)

```bash
# Every session on one task
ls agent-history/entries | grep PSI-032

# Last 10 sessions, one line each
for f in $(ls agent-history/entries/*.json | sort | tail -10); do
  jq -r '[.session.started_at, (.task_ids|join(",")), .agent.name, .outcome, .intent] | @tsv' "$f"
done

# Open follow-ups across all history
jq -r '.follow_ups[]? | "\(.task_id // "-")\t\(.note)"' agent-history/entries/*.json

# Sessions waiting for a human
jq -r 'select(.human_review.required) | "\(.id)\t\(.human_review.reason // "")"' agent-history/entries/*.json

# Every documented contract deviation
jq -r '.contract_deviations[]? as $d | "\(input_filename)\t\($d.rule)\t\($d.why)"' agent-history/entries/*.json
```

The same data is browsable in Obsidian (`Agent Log.md`, `history/`, and a "runs" count on every board card). See [integrated-obsidian-local.md](integrated-obsidian-local.md).

## 8. History vs agent memory

Both development agents also keep their own memory: Hermes (`MEMORY.md`, `USER.md`, learned skills), ECC (instincts, session summaries, the Memory Vault), Claude Code (auto-memory). None of that is the record.

| | Agent history (`agent-history/`) | Agent memory |
|---|---|---|
| Reviewed | Validated by schema, visible in PRs | Unreviewed |
| Shared | Every agent and human, via git | Per agent (Memory Vault: opt-in, git-ignored by default) |
| Purpose | What was done, verified and decided | Hints to speed up the next session |
| Can override the contract | No | No (C-19, C-20) |

When a memory turns out to be true and useful, promote it: into the docs, or into the `summary`/`decisions` of the next history entry.

## 9. Versioning the schema

- Additive, optional fields → minor bump (`1.1`); old entries stay valid.
- Renamed, removed or newly required fields → major bump (`2.0`) and a migration note here. Old entries are never rewritten; the validator accepts each entry against the version it declares.
- Schema changes follow contract §10 (humans only).
