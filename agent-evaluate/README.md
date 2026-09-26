# agent-evaluate

Measurement of agent compute: how many tokens and dollars an agent spends, how much of it is wasted, and whether providers bill what they should. Not to be confused with `agent-history/`, the governed per-session audit trail (contract C-14); this folder only reads it.

Built for Hermes (PSI-099). Hermes runs outside this repo (`%LOCALAPPDATA%\hermes`, all LLM traffic through a local OmniRoute gateway), so nothing here changes Hermes or OmniRoute: it reads their stores read-only.

## Run

```bash
bun run agent:evaluate        # writes out/steps.jsonl and reports/*
bun run agent:evaluate:test   # detector and cost-calculator tests
```

Inputs (override with env vars):

| Input | Default | Env var |
|---|---|---|
| Hermes session store | `$HERMES_HOME/state.db`, else `~/.hermes/state.db` | `HERMES_STATE_DB` |
| OmniRoute call log | `~/.omniroute/storage.sqlite` | `OMNIROUTE_DB` |
| Task outcomes | `agent-history/entries/*.json`, `docs/list-task-project.md` | — |
| Billing exports | files listed under `billing` in `config.json` | — |

## Files

| Path | What | Committed |
|---|---|---|
| `config.json` | Prices ($ per 1M input / cached / output tokens, per `provider` or `provider/model`), API key, retry threshold, budget, flag threshold, billing files | yes |
| `observability/analyze.ts` | Pure logic: parsing, run segmentation, call↔turn join, waste flags, cost, outcomes, billing reconciliation | yes |
| `observability/ingest.ts` | Read-only SQLite/JSON readers | yes |
| `observability/report.ts` | CLI: writes the JSONL, CSVs and report | yes |
| `reports/hermes_observability_report.md` + `runs.csv`, `tasks.csv`, `providers.csv`, `billing.csv` | Aggregates only | yes |
| `out/steps.jsonl` | One row per tool call (tokens and cost on each turn's first row; run-level and unattributed API calls get their own rows) | no (gitignored) |
| `data/billing/` | Raw provider billing exports | no (gitignored) |

## Privacy (C-07, C-08, C-18)

Only non-secret columns are selected: never provider credentials, API keys, or user/assistant message text. Tool arguments leave as a 16-hex SHA-256 of their canonical JSON; tool results as `ok`/`error`/`invalid`, a coarse error class and an output hash. Nothing in `out/` or `reports/` contains prompt, command or file content.

## JSONL fields

`run_id`, `task_id`, `step`, `tool_index`, `timestamp`, `session_id`, `provider`, `model`, `prompt_tokens` (uncached input), `cached_tokens`, `completion_tokens`, `cost_estimate` (USD at config prices, `null` when unpriced), `tool_name`, `tool_args_hash`, `tool_status`, `error` (class only), `retry_count` (failed attempts in the turn), `loop_flag`, `waste_flags`, `outcome`, `join` (`step` / `run` / `unattributed` / `none`), `tokens_estimated`.

Definitions of every flag and bucket are in §3 of the generated report.
