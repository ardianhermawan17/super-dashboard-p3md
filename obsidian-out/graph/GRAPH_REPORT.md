# Graph Report - super-dashboard-p3md-architecture  (2026-09-24)

## Corpus Check
- 51 files · ~51,998 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 407 nodes · 868 edges · 13 communities
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Task Plan and Feature Modules
- Agent Contract and Claude Code Ops
- Repo Scripts (obsidian-sync, agent-context)
- Edge Functions and Auth
- Google Integration and Calendar
- RBAC and Access Guards
- Graphify Architecture
- Chat and LLM Tool Layer
- Kanban Schema and Agent Layer
- MCP and Agent Auth
- Graphify Setup and Refresh
- Role Mail Schema
- Three-Layer Principle

## God Nodes (most connected - your core abstractions)
1. `List task project (PSI tasks)` - 80 edges
2. `README_AI_AGENT.md (gateway and contract)` - 58 edges
3. `Database architecture README` - 19 edges
4. `M1 RBAC migration doc` - 15 edges
5. `Google integration (Drive, Calendar)` - 14 edges
6. `Backend architecture README` - 14 edges
7. `Edge Functions` - 13 edges
8. `Module: Agent layer (MCP)` - 11 edges
9. `PSI-012 Migration M1 RBAC` - 11 edges
10. `Module: Agent ops (graphify, Hermes, ECC)` - 10 edges

## Surprising Connections (you probably didn't know these)
- `RBAC model (users, groups, roles, permissions)` --semantically_similar_to--> `Access model: User, Group, Role, Permission`  [INFERRED] [semantically similar]
  docs/database-architecture/m1-rbac.md → README_AI_AGENT.md
- `C-04 Secret key never in browser-reachable code` --conceptually_related_to--> `Security and privacy controls`  [INFERRED]
  README_AI_AGENT.md → docs/backend-architecture/operations-and-risks.md
- `C-18 Google credentials and document content stay server-side` --conceptually_related_to--> `Google integration (Drive, Calendar)`  [INFERRED]
  README_AI_AGENT.md → docs/backend-architecture/google-integration.md
- `Read-only MCP API` --implements--> `/api/mcp route (mcp-handler)`  [INFERRED]
  README_AI_AGENT.md → docs/backend-architecture/agent-layer-mcp.md
- `Module: Notifications and push` --references--> `Notification center and bell`  [INFERRED]
  docs/list-task-project.md → docs/frontend-architecture/features/notifications-pwa.md

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

## Communities (13 total, 0 thin omitted)

### Community 0 - "Task Plan and Feature Modules"
Cohesion: 0.07
Nodes (78): List task project (PSI tasks), Module: Agenda calendar, Module: Supabase clients and session, Module: Documents (Google Drive), Module: Google Calendar sync, Module: Kanban board, Module: Role and group mail, Module: Agent layer (MCP) (+70 more)

### Community 1 - "Agent Contract and Claude Code Ops"
Cohesion: 0.07
Nodes (47): Claude Code (builder lane) setup, CLAUDE.md @imports of contract, ECC rules project-local (.claude/rules/ecc), graphify install and PreToolUse hook, Contract-to-command map for Claude Code, ECC (Everything Claude Code) in this repo, AgentShield, ECC command and skill map (+39 more)

### Community 2 - "Repo Scripts (obsidian-sync, agent-context)"
Cohesion: 0.08
Nodes (44): ref_node_fs, ref_node_path, ref_node_url, build(), main(), OUT, REQUIRED, ROOT (+36 more)

### Community 3 - "Edge Functions and Auth"
Cohesion: 0.09
Nodes (37): Supabase Auth settings, Edge Functions, daily-digest (PSI-077), resend-webhook (PSI-033), send-role-mail (PSI-032), Deterministic Google event IDs (idempotent push), google-calendar Edge Function (/sync /push), google-drive Edge Function (/sync /file /search) (+29 more)

### Community 4 - "Google Integration and Calendar"
Cohesion: 0.11
Nodes (33): Google integration (Drive, Calendar), Backend architecture README, calendar_feed_tokens (ICS feed, PSI-044), can_see_event(), event_audience table (user/role/group), event_audience_user_ids(), events_for_user(), events table (+25 more)

### Community 5 - "RBAC and Access Guards"
Cohesion: 0.08
Nodes (27): M1 RBAC migration doc, assert_admin_remains() last-admin trigger, Guards (escalation, last admin, suspension, system rows), Permission catalogue, pgTAP test pattern, rbac.test.sql assertions, Conventions and guardrails, Testing layers (+19 more)

### Community 6 - "Graphify Architecture"
Cohesion: 0.08
Nodes (28): graphify architecture, Canonical graph questions, Curated dated snapshots, callflow and LESSONS, graphify-out/ engine output, .graphifyignore indexing scope, graphify install per machine and per agent, graphify Obsidian notes export (obsidian-out/graph), Phase-end snapshot procedure (+20 more)

### Community 7 - "Chat and LLM Tool Layer"
Cohesion: 0.10
Nodes (26): /api/chat route (PSI-076), defineTool / AgentTool types (define.ts), Edge Function complete() adapter (llm.ts), get_activity tool, LLM provider layer: Claude and Hermes (PSI-098), Next.js model() adapter (models.ts), Agent tool registry (registry.ts), Agent tool rules (+18 more)

### Community 8 - "Kanban Schema and Agent Layer"
Cohesion: 0.13
Nodes (21): Agent layer (MCP + in-app chat), board_columns table, board_members / board_groups tables, boards table, Fractional position ordering (collate C), is_board_member()/is_board_owner(), notify_task_assignee trigger, supabase_realtime publication (tasks, board_columns) (+13 more)

### Community 9 - "MCP and Agent Auth"
Cohesion: 0.14
Nodes (20): Shared MCP servers, agent_audit_log, /api/mcp route (mcp-handler), runTool (runtime.ts), verifySupabaseToken (JWKS), Auth and onboarding, /auth/consent page and Connected apps revoke, Supabase OAuth 2.1 server for agents (PSI-074) (+12 more)

### Community 10 - "Graphify Setup and Refresh"
Cohesion: 0.23
Nodes (16): graphify architecture, .graphifyignore, graphify install for Claude Code and Hermes, Phase-end snapshot, Graph refresh rules, graphify-out vs docs/graphify-architecture, Module: Agent ops (graphify, Hermes, ECC), PSI-003 Docs pack and gateway (+8 more)

### Community 11 - "Role Mail Schema"
Cohesion: 0.50
Nodes (7): has_permission() (mail.send, mail.audit), mail_recipient_count() function, mail_recipients() function, message_recipients table, messages table (role/group mail), is_message_sender / is_message_recipient helpers, send-role-mail Edge Function

### Community 12 - "Three-Layer Principle"
Cohesion: 0.40
Nodes (5): Backend layer (Edge Functions, route handlers, Auth config), Database layer (Postgres, RLS, triggers, pg_cron), Frontend layer (Next.js Server Components, Server Actions, PWA), internal_post() / pg_net dispatch, Three layers: frontend, backend, database

## Knowledge Gaps
- **68 isolated node(s):** `Check`, `Entry`, `Status`, `Task`, `OUT` (+63 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 80 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `README_AI_AGENT.md (gateway and contract)` connect `Agent Contract and Claude Code Ops` to `Task Plan and Feature Modules`, `Edge Functions and Auth`, `Google Integration and Calendar`, `RBAC and Access Guards`, `Graphify Architecture`, `Chat and LLM Tool Layer`, `Kanban Schema and Agent Layer`, `MCP and Agent Auth`, `Graphify Setup and Refresh`, `Role Mail Schema`?**
  _High betweenness centrality (0.645) - this node is a cross-community bridge._
- **Why does `List task project (PSI tasks)` connect `Task Plan and Feature Modules` to `Agent Contract and Claude Code Ops`, `Graphify Setup and Refresh`, `Repo Scripts (obsidian-sync, agent-context)`, `Graphify Architecture`?**
  _High betweenness centrality (0.404) - this node is a cross-community bridge._
- **Why does `Historical agent work` connect `Graphify Architecture` to `Task Plan and Feature Modules`, `Agent Contract and Claude Code Ops`, `Repo Scripts (obsidian-sync, agent-context)`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `M1 RBAC migration doc` (e.g. with `rbac.test.sql assertions` and `Canonical graph questions`) actually correct?**
  _`M1 RBAC migration doc` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Check`, `Entry`, `Status` to the rest of the system?**
  _68 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Task Plan and Feature Modules` be split into smaller, more focused modules?**
  _Cohesion score 0.07392607392607392 - nodes in this community are weakly interconnected._
- **Should `Agent Contract and Claude Code Ops` be split into smaller, more focused modules?**
  _Cohesion score 0.0673758865248227 - nodes in this community are weakly interconnected._