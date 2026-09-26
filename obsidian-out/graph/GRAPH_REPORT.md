# Graph Report - super-dashboard-p3md-architecture  (2026-09-26)

## Corpus Check
- 80 files · ~61,834 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 5, .toml 1)

## Summary
- 518 nodes · 1035 edges · 26 communities (23 shown, 3 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `721c014b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- List task project (PSI tasks)
- README_AI_AGENT.md (gateway and contract)
- Repo Scripts (obsidian-sync, agent-context)
- send-role-mail (PSI-032)
- Google Integration and Calendar
- Supabase clients and session
- Graphify Architecture
- M1 RBAC migration doc
- Kanban Schema and Agent Layer
- Supabase OAuth 2.1 server for agents (PSI-074)
- Module: Agent ops (graphify, Hermes, ECC)
- m3-role-mail.md
- Three-Layer Principle
- xref.mjs
- Communities (13 total, 0 thin omitted)
- System overview
- 2. Step-by-Step Review Procedure
- What a Review File Must Contain
- Jev Ultrafast Browser Agent Rules & Specification (`format.md`)
- README.md
- index.ts
- m9-talent.md
- Kanban feature (frontend)
- CLAUDE.md — Project Gateway
- data-layer-pattern.md
- pre-commit

## God Nodes (most connected - your core abstractions)
1. `List task project (PSI tasks)` - 80 edges
2. `README_AI_AGENT.md (gateway and contract)` - 69 edges
3. `System overview` - 31 edges
4. `Database architecture README` - 19 edges
5. `M1 RBAC migration doc` - 18 edges
6. `Google integration (Drive, Calendar)` - 17 edges
7. `Edge Functions` - 16 edges
8. `Backend architecture README` - 16 edges
9. `Communities (13 total, 0 thin omitted)` - 14 edges
10. `Agent operations README` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Branch Rule` --references--> `main()`  [INFERRED]
  docs/review-rules.md → scripts/agent-context.ts
- `Agent Rules (from Contract C-03)` --references--> `main()`  [INFERRED]
  AGENTS.md → scripts/agent-context.ts
- `Branch Rule` --references--> `main()`  [INFERRED]
  docs/review-process.md → scripts/agent-context.ts
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

## Communities (26 total, 3 thin omitted)

### Community 0 - "List task project (PSI tasks)"
Cohesion: 0.07
Nodes (78): List task project (PSI tasks), Module: Agenda calendar, Module: Supabase clients and session, Module: Documents (Google Drive), Module: Google Calendar sync, Module: Kanban board, Module: Role and group mail, Module: Agent layer (MCP) (+70 more)

### Community 1 - "README_AI_AGENT.md (gateway and contract)"
Cohesion: 0.09
Nodes (36): Claude Code (builder lane) setup, CLAUDE.md @imports of contract, ECC rules project-local (.claude/rules/ecc), graphify install and PreToolUse hook, Contract-to-command map for Claude Code, ECC (Everything Claude Code) in this repo, AgentShield, ECC command and skill map (+28 more)

### Community 2 - "Repo Scripts (obsidian-sync, agent-context)"
Cohesion: 0.12
Nodes (33): ref_ajv, ref_ajv_formats, AREAS, args, cell(), dayWIB(), FIELDS, HISTORY_DIR (+25 more)

### Community 3 - "send-role-mail (PSI-032)"
Cohesion: 0.06
Nodes (45): Edge Function complete() adapter (llm.ts), Supabase Auth settings, daily-digest (PSI-077), resend-webhook (PSI-033), send-role-mail (PSI-032), Deterministic Google event IDs (idempotent push), google-calendar Edge Function (/sync /push), google-drive Edge Function (/sync /file /search) (+37 more)

### Community 4 - "Google Integration and Calendar"
Cohesion: 0.16
Nodes (21): calendar_feed_tokens (ICS feed, PSI-044), can_see_event(), event_audience table (user/role/group), event_audience_user_ids(), events_for_user(), events table, notify_event_invites trigger, notify_event_update trigger (+13 more)

### Community 5 - "Supabase clients and session"
Cohesion: 0.18
Nodes (12): Notifications and PWA feature (frontend), Device support and QA, enablePush device opt-in, Notification center and bell, Notification-first PWA decision, PWA shell (manifest, sw.js), Supabase clients and session, Permission-filtered navigation (visibleNav) (+4 more)

### Community 6 - "Graphify Architecture"
Cohesion: 0.08
Nodes (28): graphify architecture, Canonical graph questions, Curated dated snapshots, callflow and LESSONS, graphify-out/ engine output, .graphifyignore indexing scope, graphify install per machine and per agent, graphify Obsidian notes export (obsidian-out/graph), Phase-end snapshot procedure (+20 more)

### Community 7 - "M1 RBAC migration doc"
Cohesion: 0.22
Nodes (10): M1 RBAC migration doc, RBAC model (users, groups, roles, permissions), Permission catalogue, admin_list_users() helper, Admin pages (users/groups/roles/permissions), Setup and structure (frontend), Environment variables, Target folder structure (+2 more)

### Community 8 - "Kanban Schema and Agent Layer"
Cohesion: 0.27
Nodes (12): board_columns table, board_members / board_groups tables, boards table, Fractional position ordering (collate C), is_board_member()/is_board_owner(), notify_task_assignee trigger, supabase_realtime publication (tasks, board_columns), tasks table (+4 more)

### Community 9 - "Supabase OAuth 2.1 server for agents (PSI-074)"
Cohesion: 0.07
Nodes (39): Hermes gateway security (remote shell), Coordination rules, Shared MCP servers, agent_audit_log, /api/chat route (PSI-076), defineTool / AgentTool types (define.ts), get_activity tool, LLM provider layer: Claude and Hermes (PSI-098) (+31 more)

### Community 10 - "Module: Agent ops (graphify, Hermes, ECC)"
Cohesion: 0.23
Nodes (16): graphify architecture, .graphifyignore, graphify install for Claude Code and Hermes, Phase-end snapshot, Graph refresh rules, graphify-out vs docs/graphify-architecture, Module: Agent ops (graphify, Hermes, ECC), PSI-003 Docs pack and gateway (+8 more)

### Community 11 - "m3-role-mail.md"
Cohesion: 0.23
Nodes (11): has_permission() (mail.send, mail.audit), mail_recipient_count() function, mail_recipients() function, message_recipients table, messages table (role/group mail), is_message_sender / is_message_recipient helpers, send-role-mail Edge Function, pgTAP test pattern (+3 more)

### Community 12 - "Three-Layer Principle"
Cohesion: 0.40
Nodes (5): Backend layer (Edge Functions, route handlers, Auth config), Database layer (Postgres, RLS, triggers, pg_cron), Frontend layer (Next.js Server Components, Server Actions, PWA), internal_post() / pg_net dispatch, Three layers: frontend, backend, database

### Community 13 - "xref.mjs"
Cohesion: 0.04
Nodes (39): Agent Rules (from Contract C-03), Critical Conventions, Data Fetching, Forms, graphify, Project Overview, Repository Structure, Routing & Params (+31 more)

### Community 14 - "Communities (13 total, 0 thin omitted)"
Cohesion: 0.08
Nodes (28): Communities (13 total, 0 thin omitted), Community 0 - "Task Plan and Feature Modules", Community 10 - "Graphify Setup and Refresh", Community 11 - "Role Mail Schema", Community 12 - "Three-Layer Principle", Community 1 - "Agent Contract and Claude Code Ops", Community 2 - "Repo Scripts (obsidian-sync, agent-context)", Community 3 - "Edge Functions and Auth" (+20 more)

### Community 15 - "System overview"
Cohesion: 0.23
Nodes (16): Agent layer (MCP + in-app chat), Auth and onboarding, Edge Functions, Local workflow and deploy, Function and migration deploy (PSI-091), Push notifications (delivery pipeline), Backend architecture README, M2 Notifications and push migration doc (+8 more)

### Community 16 - "2. Step-by-Step Review Procedure"
Cohesion: 0.17
Nodes (11): 1. Core Rule, 1. Typecheck / Build / Test, 2. Step-by-Step Review Procedure, 3. Standard Review Document Template (`obsidian-out/review/PSI-NNN.md`), 4. Step 4: Vault Synchronization, 5. Board = Source of Truth (Contract C-21), Review Protocol & Obsidian Review Workflow, Step 1: Git Branch Checkout & Rebase (+3 more)

### Community 17 - "What a Review File Must Contain"
Cohesion: 0.18
Nodes (10): 1. Feature Summary, 2. Work Done, 3. Expected Output, 4. Verification Evidence, 5. Decision, Branch Rule, Review Cadence, Review Process Rules (+2 more)

### Community 18 - "Jev Ultrafast Browser Agent Rules & Specification (`format.md`)"
Cohesion: 0.20
Nodes (8): Jev Ultrafast Browser Agent, Key Integration Points, 1. System Overview & Architecture, 2. Service Endpoints & Execution, 3. Mandatory Agent Rules for Web Tasks, API & Command Reference, Core Components, Jev Ultrafast Browser Agent Rules & Specification (`format.md`)

### Community 19 - "README.md"
Cohesion: 0.31
Nodes (8): Google integration (Drive, Calendar), big-calendar port, Documents feature (frontend), Document viewer (google-drive/file proxy), Talent feature (frontend), Consent and CV intake (private cvs bucket), db-review, psi012-verify.sql

### Community 20 - "index.ts"
Cohesion: 0.47
Nodes (4): ref_npm_supabase, admin, cors, json()

### Community 21 - "m9-talent.md"
Cohesion: 0.80
Nodes (4): candidate_group_scores view, candidate_skills table, candidates table, Skill taxonomy tables

### Community 22 - "Kanban feature (frontend)"
Cohesion: 0.50
Nodes (4): Kanban feature (frontend), Board membership (users and groups), useBoardRealtime, Fractional-indexing positions (collate C)

## Knowledge Gaps
- **130 isolated node(s):** `ROOT`, `OUT`, `SOURCES`, `REQUIRED`, `files` (+125 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 154 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `README_AI_AGENT.md (gateway and contract)` connect `README_AI_AGENT.md (gateway and contract)` to `List task project (PSI tasks)`, `send-role-mail (PSI-032)`, `Google Integration and Calendar`, `Supabase clients and session`, `Graphify Architecture`, `M1 RBAC migration doc`, `Kanban Schema and Agent Layer`, `Supabase OAuth 2.1 server for agents (PSI-074)`, `Module: Agent ops (graphify, Hermes, ECC)`, `m3-role-mail.md`, `xref.mjs`, `System overview`, `README.md`, `m9-talent.md`, `Kanban feature (frontend)`, `data-layer-pattern.md`?**
  _High betweenness centrality (0.580) - this node is a cross-community bridge._
- **Why does `List task project (PSI tasks)` connect `List task project (PSI tasks)` to `README_AI_AGENT.md (gateway and contract)`, `Module: Agent ops (graphify, Hermes, ECC)`, `Repo Scripts (obsidian-sync, agent-context)`, `Graphify Architecture`?**
  _High betweenness centrality (0.329) - this node is a cross-community bridge._
- **Why does `Integrated Obsidian (local)` connect `Graphify Architecture` to `List task project (PSI tasks)`, `README_AI_AGENT.md (gateway and contract)`, `Repo Scripts (obsidian-sync, agent-context)`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `M1 RBAC migration doc` (e.g. with `rbac.test.sql assertions` and `Canonical graph questions`) actually correct?**
  _`M1 RBAC migration doc` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ROOT`, `OUT`, `SOURCES` to the rest of the system?**
  _130 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `List task project (PSI tasks)` be split into smaller, more focused modules?**
  _Cohesion score 0.07392607392607392 - nodes in this community are weakly interconnected._
- **Should `README_AI_AGENT.md (gateway and contract)` be split into smaller, more focused modules?**
  _Cohesion score 0.08888888888888889 - nodes in this community are weakly interconnected._