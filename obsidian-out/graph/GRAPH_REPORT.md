# Graph Report - super-dashboard-p3md-architecture  (2026-09-26)

## Corpus Check
- 80 files · ~61,834 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 5, .toml 1)

## Summary
- 522 nodes · 1056 edges · 28 communities (26 shown, 2 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a4f38254`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- List task project (PSI tasks)
- Claude Code (builder lane) setup
- Repo Scripts (obsidian-sync, agent-context)
- send-role-mail (PSI-032)
- Google Integration and Calendar
- AGENTS.md
- Historical agent work
- agent-context.ts
- Kanban Schema and Agent Layer
- Supabase OAuth 2.1 server for agents (PSI-074)
- graphify architecture
- m3-role-mail.md
- Three-Layer Principle
- xref.mjs
- Communities (13 total, 0 thin omitted)
- README_AI_AGENT.md (gateway and contract)
- 2. Step-by-Step Review Procedure
- What a Review File Must Contain
- Jev Ultrafast Browser Agent Rules & Specification (`format.md`)
- Agent history entry JSON contract (schema.json)
- index.ts
- graphify architecture
- Agent operations README
- CLAUDE.md — Project Gateway
- Hermes Agent (operator lane) setup
- pre-commit
- Review Process & `master` Branch Convention
- extract.mjs

## God Nodes (most connected - your core abstractions)
1. `List task project (PSI tasks)` - 80 edges
2. `README_AI_AGENT.md (gateway and contract)` - 70 edges
3. `System overview` - 32 edges
4. `Database architecture README` - 20 edges
5. `M1 RBAC migration doc` - 19 edges
6. `Google integration (Drive, Calendar)` - 18 edges
7. `Backend architecture README` - 17 edges
8. `Edge Functions` - 16 edges
9. `Communities (13 total, 0 thin omitted)` - 14 edges
10. `Supabase clients and session` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Branch Rule` --references--> `main()`  [INFERRED]
  docs/review-process.md → scripts/agent-context.ts
- `Branch Rule` --references--> `main()`  [INFERRED]
  docs/review-rules.md → scripts/agent-context.ts
- `Agent Rules (from Contract C-03)` --references--> `main()`  [INFERRED]
  AGENTS.md → scripts/agent-context.ts
- `Knowledge Gaps` --references--> `Task`  [INFERRED]
  docs/graphify-architecture/snapshots/2026-09-25_phase-0.md → scripts/obsidian-sync.ts
- `Knowledge Gaps` --references--> `Status`  [INFERRED]
  docs/graphify-architecture/snapshots/2026-09-25_phase-0.md → scripts/obsidian-sync.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Trigger-fed activity log** — docs_database_architecture_m7_activity_log_activity_log_table, docs_database_architecture_m7_activity_log_log_triggers, docs_database_architecture_m5_kanban_tasks_table, docs_database_architecture_m4_calendar_events_table, docs_database_architecture_m3_role_mail_messages_table [EXTRACTED 1.00]
- **Shared agent tool layer (MCP + chat)** — docs_backend_architecture_agent_layer_mcp_tool_registry, docs_backend_architecture_agent_layer_mcp_mcp_route, docs_backend_architecture_agent_layer_mcp_chat_route, docs_backend_architecture_agent_layer_mcp_run_tool, docs_backend_architecture_agent_layer_mcp_verify_supabase_token [EXTRACTED 1.00]
- **Task list, history and Obsidian tracking loop** — docs_list_task_project, docs_historical_agent_work, docs_integrated_obsidian_local, scripts_obsidian_sync [EXTRACTED 1.00]
- **Contract delivery to Claude Code, Hermes and other agents** — readme_ai_agent, docs_agent_operations_claude_code_claude_md_imports, docs_agent_operations_hermes_hermes_md, docs_agent_operations_readme_three_delivery_paths [EXTRACTED 1.00]
- **Task list and agent history to Obsidian vault** — docs_list_task_project, docs_historical_agent_work_entry_contract, docs_integrated_obsidian_local_obsidian_sync_script, docs_integrated_obsidian_local_kanban_board, docs_integrated_obsidian_local_agent_log [EXTRACTED 1.00]
- **Calendar event to Google push flow** — docs_database_architecture_m4_calendar_events_table, docs_database_architecture_m4_calendar_event_audience_table, docs_database_architecture_m6_google_event_google_links, docs_database_architecture_m6_google_queue_google_push, docs_database_architecture_m6_google_google_calendars_table [EXTRACTED 1.00]
- **Notification to Web Push pipeline** — docs_database_architecture_m2_notifications_notify, docs_database_architecture_m2_notifications_dispatch_push, docs_database_architecture_m2_notifications_internal_post, docs_backend_architecture_push_notifications_dispatch_route, docs_database_architecture_m2_notifications_push_targets [EXTRACTED 1.00]
- **Role/group mail send flow** — docs_database_architecture_m3_role_mail_messages_table, docs_database_architecture_m3_role_mail_message_recipients_table, docs_database_architecture_m3_role_mail_mail_recipients_fn, docs_database_architecture_m3_role_mail_send_role_mail, docs_database_architecture_m3_role_mail_mail_recipient_count_fn [INFERRED 0.85]

## Communities (28 total, 2 thin omitted)

### Community 0 - "List task project (PSI tasks)"
Cohesion: 0.07
Nodes (88): List task project (PSI tasks), Module: Agent ops (graphify, Hermes, ECC), Module: Agenda calendar, Module: Supabase clients and session, Module: Documents (Google Drive), Module: Google Calendar sync, Module: Kanban board, Module: Role and group mail (+80 more)

### Community 1 - "Claude Code (builder lane) setup"
Cohesion: 0.15
Nodes (17): Claude Code (builder lane) setup, CLAUDE.md @imports of contract, ECC rules project-local (.claude/rules/ecc), graphify install and PreToolUse hook, Contract-to-command map for Claude Code, ECC (Everything Claude Code) in this repo, AgentShield, ECC command and skill map (+9 more)

### Community 2 - "Repo Scripts (obsidian-sync, agent-context)"
Cohesion: 0.12
Nodes (33): ref_ajv, ref_ajv_formats, AREAS, args, cell(), dayWIB(), FIELDS, HISTORY_DIR (+25 more)

### Community 3 - "send-role-mail (PSI-032)"
Cohesion: 0.07
Nodes (38): Edge Function complete() adapter (llm.ts), Supabase Auth settings, daily-digest (PSI-077), resend-webhook (PSI-033), send-role-mail (PSI-032), Deterministic Google event IDs (idempotent push), google-calendar Edge Function (/sync /push), google-drive Edge Function (/sync /file /search) (+30 more)

### Community 4 - "Google Integration and Calendar"
Cohesion: 0.16
Nodes (21): calendar_feed_tokens (ICS feed, PSI-044), can_see_event(), event_audience table (user/role/group), event_audience_user_ids(), events_for_user(), events table, notify_event_invites trigger, notify_event_update trigger (+13 more)

### Community 5 - "AGENTS.md"
Cohesion: 0.18
Nodes (9): Critical Conventions, Data Fetching, Forms, graphify, Project Overview, Repository Structure, Routing & Params, Styling (+1 more)

### Community 6 - "Historical agent work"
Cohesion: 0.20
Nodes (10): graphify Obsidian notes export (obsidian-out/graph), Historical agent work, Append-only entries rule, Agent history JSON entry, agent-history schema.json, Schema versioning policy, Integrated Obsidian (local), Board.md kanban (+2 more)

### Community 7 - "agent-context.ts"
Cohesion: 0.22
Nodes (9): Agent Rules (from Contract C-03), ref_node_path, ref_node_url, build(), main(), OUT, REQUIRED, ROOT (+1 more)

### Community 8 - "Kanban Schema and Agent Layer"
Cohesion: 0.27
Nodes (12): board_columns table, board_members / board_groups tables, boards table, Fractional position ordering (collate C), is_board_member()/is_board_owner(), notify_task_assignee trigger, supabase_realtime publication (tasks, board_columns), tasks table (+4 more)

### Community 9 - "Supabase OAuth 2.1 server for agents (PSI-074)"
Cohesion: 0.07
Nodes (35): Hermes gateway security (remote shell), Shared MCP servers, agent_audit_log, /api/chat route (PSI-076), defineTool / AgentTool types (define.ts), get_activity tool, LLM provider layer: Claude and Hermes (PSI-098), /api/mcp route (mcp-handler) (+27 more)

### Community 10 - "graphify architecture"
Cohesion: 0.33
Nodes (6): graphify architecture, .graphifyignore, graphify install for Claude Code and Hermes, Phase-end snapshot, Graph refresh rules, graphify-out vs docs/graphify-architecture

### Community 11 - "m3-role-mail.md"
Cohesion: 0.50
Nodes (7): has_permission() (mail.send, mail.audit), mail_recipient_count() function, mail_recipients() function, message_recipients table, messages table (role/group mail), is_message_sender / is_message_recipient helpers, send-role-mail Edge Function

### Community 12 - "Three-Layer Principle"
Cohesion: 0.40
Nodes (5): Backend layer (Edge Functions, route handlers, Auth config), Database layer (Postgres, RLS, triggers, pg_cron), Frontend layer (Next.js Server Components, Server Actions, PWA), internal_post() / pg_net dispatch, Three layers: frontend, backend, database

### Community 13 - "xref.mjs"
Cohesion: 0.14
Nodes (10): audit, ext, files, fns, known, perms, refs, tables (+2 more)

### Community 14 - "Communities (13 total, 0 thin omitted)"
Cohesion: 0.08
Nodes (28): Communities (13 total, 0 thin omitted), Community 0 - "Task Plan and Feature Modules", Community 10 - "Graphify Setup and Refresh", Community 11 - "Role Mail Schema", Community 12 - "Three-Layer Principle", Community 1 - "Agent Contract and Claude Code Ops", Community 2 - "Repo Scripts (obsidian-sync, agent-context)", Community 3 - "Edge Functions and Auth" (+20 more)

### Community 15 - "README_AI_AGENT.md (gateway and contract)"
Cohesion: 0.05
Nodes (79): Agent layer (MCP + in-app chat), Auth and onboarding, Edge Functions, Google integration (Drive, Calendar), Local workflow and deploy, Function and migration deploy (PSI-091), Push notifications (delivery pipeline), Backend architecture README (+71 more)

### Community 16 - "2. Step-by-Step Review Procedure"
Cohesion: 0.17
Nodes (11): 1. Core Rule, 1. Typecheck / Build / Test, 2. Step-by-Step Review Procedure, 3. Standard Review Document Template (`obsidian-out/review/PSI-NNN.md`), 4. Step 4: Vault Synchronization, 5. Board = Source of Truth (Contract C-21), Review Protocol & Obsidian Review Workflow, Step 1: Git Branch Checkout & Rebase (+3 more)

### Community 17 - "What a Review File Must Contain"
Cohesion: 0.18
Nodes (10): 1. Feature Summary, 2. Work Done, 3. Expected Output, 4. Verification Evidence, 5. Decision, Branch Rule, Review Cadence, Review Process Rules (+2 more)

### Community 18 - "Jev Ultrafast Browser Agent Rules & Specification (`format.md`)"
Cohesion: 0.20
Nodes (8): Jev Ultrafast Browser Agent, Key Integration Points, 1. System Overview & Architecture, 2. Service Endpoints & Execution, 3. Mandatory Agent Rules for Web Tasks, API & Command Reference, Core Components, Jev Ultrafast Browser Agent Rules & Specification (`format.md`)

### Community 19 - "Agent history entry JSON contract (schema.json)"
Cohesion: 0.24
Nodes (10): bun run agent:check validation, Agent history entry JSON contract (schema.json), Agent history vs agent memory, One file per session, append-only entries, Rules C-12/C-13/C-14 (truthful verification and outcome), Agent Log and session notes, Dataview queries, Kanban Board.md and vault outputs (+2 more)

### Community 20 - "index.ts"
Cohesion: 0.47
Nodes (4): ref_npm_supabase, admin, cors, json()

### Community 21 - "graphify architecture"
Cohesion: 0.29
Nodes (8): graphify architecture, Canonical graph questions, Curated dated snapshots, callflow and LESSONS, graphify-out/ engine output, .graphifyignore indexing scope, graphify install per machine and per agent, Phase-end snapshot procedure, Graph refresh rules

### Community 22 - "Agent operations README"
Cohesion: 0.33
Nodes (7): ECC Memory Vault (scratchpad handoffs), Agent operations README, Coordination rules, Handoffs (governed vs scratchpad), Builder and operator lanes, C-03 Claim before editing (one task, one agent, one branch), C-20 Memories are not facts

### Community 24 - "Hermes Agent (operator lane) setup"
Cohesion: 0.29
Nodes (7): Hermes Agent (operator lane) setup, When Hermes builds (per-task flow), Hermes standing cron jobs (PSI-096), Google Cloud setup (PSI-060), C-15 Human gates, Hermes Agent (default operator), Task protocol

### Community 26 - "Review Process & `master` Branch Convention"
Cohesion: 0.29
Nodes (6): Agent Rules (merged from Contract C-03), Branch Rule, Files, Review Document Sections, Review Gate, Review Process & `master` Branch Convention

### Community 27 - "extract.mjs"
Cohesion: 0.33
Nodes (5): ref_node_fs, files, index, out, SKIP

## Knowledge Gaps
- **132 isolated node(s):** `ROOT`, `OUT`, `SOURCES`, `REQUIRED`, `files` (+127 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 156 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `README_AI_AGENT.md (gateway and contract)` connect `README_AI_AGENT.md (gateway and contract)` to `List task project (PSI tasks)`, `Claude Code (builder lane) setup`, `send-role-mail (PSI-032)`, `Google Integration and Calendar`, `AGENTS.md`, `Historical agent work`, `Kanban Schema and Agent Layer`, `Supabase OAuth 2.1 server for agents (PSI-074)`, `graphify architecture`, `m3-role-mail.md`, `graphify architecture`, `Agent operations README`, `Hermes Agent (operator lane) setup`?**
  _High betweenness centrality (0.578) - this node is a cross-community bridge._
- **Why does `List task project (PSI tasks)` connect `List task project (PSI tasks)` to `Repo Scripts (obsidian-sync, agent-context)`, `Agent history entry JSON contract (schema.json)`, `Historical agent work`, `README_AI_AGENT.md (gateway and contract)`?**
  _High betweenness centrality (0.327) - this node is a cross-community bridge._
- **Why does `Integrated Obsidian (local)` connect `Historical agent work` to `List task project (PSI tasks)`, `Repo Scripts (obsidian-sync, agent-context)`, `README_AI_AGENT.md (gateway and contract)`, `graphify architecture`, `Hermes Agent (operator lane) setup`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `M1 RBAC migration doc` (e.g. with `rbac.test.sql assertions` and `Canonical graph questions`) actually correct?**
  _`M1 RBAC migration doc` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ROOT`, `OUT`, `SOURCES` to the rest of the system?**
  _132 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `List task project (PSI tasks)` be split into smaller, more focused modules?**
  _Cohesion score 0.06635318704284221 - nodes in this community are weakly interconnected._
- **Should `Claude Code (builder lane) setup` be split into smaller, more focused modules?**
  _Cohesion score 0.14705882352941177 - nodes in this community are weakly interconnected._