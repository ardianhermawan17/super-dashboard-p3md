# Graph Report - super-dashboard-p3md-architecture  (2026-09-30)

## Corpus Check
- 120 files · ~107,662 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 5, .csv 4, .toml 1)

## Summary
- 814 nodes · 1577 edges · 55 communities (53 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d7cade29`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- List task project (PSI tasks)
- Claude Code (builder lane) setup
- obsidian-sync.ts
- frontend-architecture/README.md
- m3-role-mail.md
- Database architecture README
- send-role-mail (PSI-032)
- tally
- m4-calendar.md
- System overview
- HANDOFF.md
- analyze.ts
- Three-Layer Principle
- AGENTS.md
- Hermes Agent (operator lane) setup
- README_AI_AGENT.md (gateway and contract)
- 2. Step-by-Step Review Procedure
- What a Review File Must Contain
- Jev Ultrafast Browser Agent Rules & Specification (`format.md`)
- Agent history entry JSON contract (schema.json)
- google-calendar/index.ts
- Supabase clients and session
- agent-context.ts
- CLAUDE.md — Project Gateway
- daily-digest (PSI-077)
- pre-commit
- reconcile
- report.ts
- Tutorial · Connect the Google Calendar API (PSI-060, part 2 of 2)
- ingest.ts
- C-18 Google credentials and document content stay server-side
- Hermes observability report
- C-08 Talent data is personal data under UU PDP
- M10 · Finance (event cashflow)
- agent-evaluate
- Review Process & `master` Branch Convention
- Finance (event cashflow) and the event → board → finance streamline
- Supabase project settings
- Operations and risks
- Agent operations README
- Supabase OAuth 2.1 server for agents (PSI-074)
- /api/push/dispatch route
- ref_node_fs
- Agent tool registry (registry.ts)
- m9-talent.md
- Historical agent work
- add
- xref.mjs
- graphify architecture
- m6-google.md
- 3. Client-by-Client Setup Guide
- M12 + M13 · Task lifecycle, task cash and the CPM network
- Task lifecycle, CPM network and earned value
- Phase 11 brief · kanban task → CPM network → earned value
- Frontend architecture

## God Nodes (most connected - your core abstractions)
1. `List task project (PSI tasks)` - 81 edges
2. `README_AI_AGENT.md (gateway and contract)` - 76 edges
3. `System overview` - 36 edges
4. `Database architecture README` - 22 edges
5. `M1 RBAC migration doc` - 20 edges
6. `renderReport()` - 19 edges
7. `Google integration (Drive, Calendar)` - 19 edges
8. `Backend architecture README` - 17 edges
9. `Edge Functions` - 16 edges
10. `Tutorial · Connect the Google Calendar API (PSI-060, part 2 of 2)` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Branch Rule` --references--> `main()`  [INFERRED]
  docs/review-process.md → scripts/agent-context.ts
- `Branch Rule` --references--> `main()`  [INFERRED]
  docs/review-rules.md → scripts/agent-context.ts
- `3. Definitions` --references--> `main()`  [INFERRED]
  agent-evaluate/reports/hermes_observability_report.md → scripts/agent-context.ts
- `Agent Rules (from Contract C-03)` --references--> `main()`  [INFERRED]
  AGENTS.md → scripts/agent-context.ts
- `Knowledge Gaps` --references--> `Task`  [INFERRED]
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

## Communities (55 total, 2 thin omitted)

### Community 0 - "List task project (PSI tasks)"
Cohesion: 0.07
Nodes (89): Notification center and bell, List task project (PSI tasks), Module: Agent ops (graphify, Hermes, ECC), Module: Agenda calendar, Module: Supabase clients and session, Module: Documents (Google Drive), Module: Google Calendar sync, Module: Kanban board (+81 more)

### Community 1 - "Claude Code (builder lane) setup"
Cohesion: 0.15
Nodes (17): Claude Code (builder lane) setup, CLAUDE.md @imports of contract, ECC rules project-local (.claude/rules/ecc), graphify install and PreToolUse hook, Contract-to-command map for Claude Code, ECC (Everything Claude Code) in this repo, AgentShield, ECC command and skill map (+9 more)

### Community 2 - "obsidian-sync.ts"
Cohesion: 0.05
Nodes (63): Communities (13 total, 0 thin omitted), Community 0 - "Task Plan and Feature Modules", Community 10 - "Graphify Setup and Refresh", Community 11 - "Role Mail Schema", Community 12 - "Three-Layer Principle", Community 1 - "Agent Contract and Claude Code Ops", Community 2 - "Repo Scripts (obsidian-sync, agent-context)", Community 3 - "Edge Functions and Auth" (+55 more)

### Community 3 - "frontend-architecture/README.md"
Cohesion: 0.17
Nodes (16): Google integration (Drive, Calendar), admin_list_users() helper, Admin pages (users/groups/roles/permissions), big-calendar port, Documents feature (frontend), Document viewer (google-drive/file proxy), Role and group mail feature (frontend), to: one-liner parser (parseOneLiner) (+8 more)

### Community 4 - "m3-role-mail.md"
Cohesion: 0.42
Nodes (8): has_permission() (mail.send, mail.audit), mail_recipient_count() function, mail_recipients() function, message_recipients table, messages table (role/group mail), is_message_sender / is_message_recipient helpers, send-role-mail Edge Function, pgTAP test pattern

### Community 5 - "Database architecture README"
Cohesion: 0.16
Nodes (16): Principle: permissions, not roles, Principle: RLS-first, M1 RBAC migration doc, RBAC model (users, groups, roles, permissions), Permission catalogue, RBAC rules (membership from tables, no escalation, last admin), Database architecture README, Adding a migration checklist (+8 more)

### Community 6 - "send-role-mail (PSI-032)"
Cohesion: 0.18
Nodes (11): resend-webhook (PSI-033), send-role-mail (PSI-032), Principle: agents read curated surfaces, Principle: idempotent side effects, Principle: one way to call inward (internal_post), Principle: SQL first, Edge Functions for the edge, Backend topology (Next.js, Supabase, externals), has_permission() (+3 more)

### Community 7 - "tally"
Cohesion: 0.17
Nodes (15): buckets, retryCount(), scale(), tally, tokensOf(), zero(), billingRows, callRow() (+7 more)

### Community 8 - "m4-calendar.md"
Cohesion: 0.15
Nodes (23): calendar_feed_tokens (ICS feed, PSI-044), can_see_event(), event_audience table (user/role/group), event_audience_user_ids(), events_for_user(), events table, notify_event_invites trigger, notify_event_update trigger (+15 more)

### Community 9 - "System overview"
Cohesion: 0.28
Nodes (12): Agent layer (MCP + in-app chat), Auth and onboarding, Edge Functions, Local workflow and deploy, Function and migration deploy (PSI-091), Push notifications (delivery pipeline), Backend architecture README, M2 Notifications and push migration doc (+4 more)

### Community 10 - "HANDOFF.md"
Cohesion: 0.25
Nodes (7): Cron Jobs Status (Priority rule: EVADE cronjobs task/scheduler), Current priority: Phase 11 (kanban task → CPM network → earned value), Human / Infra Next Actions, Latest Delivered Features, Master State, Phase 8 (Talent) is on hold, Test & Build Status

### Community 11 - "analyze.ts"
Cohesion: 0.07
Nodes (41): BillingDay, branchSwitch(), Bucket, buildSteps(), canonical(), CHECKS, firstAtOrAfter(), flagSteps() (+33 more)

### Community 12 - "Three-Layer Principle"
Cohesion: 0.40
Nodes (5): Backend layer (Edge Functions, route handlers, Auth config), Database layer (Postgres, RLS, triggers, pg_cron), Frontend layer (Next.js Server Components, Server Actions, PWA), internal_post() / pg_net dispatch, Three layers: frontend, backend, database

### Community 13 - "AGENTS.md"
Cohesion: 0.18
Nodes (9): Critical Conventions, Data Fetching, Forms, graphify, Project Overview, Repository Structure, Routing & Params, Styling (+1 more)

### Community 14 - "Hermes Agent (operator lane) setup"
Cohesion: 0.18
Nodes (14): Hermes Agent (operator lane) setup, Hermes standing cron jobs (PSI-096), graphify architecture, Canonical graph questions, Curated dated snapshots, callflow and LESSONS, graphify-out/ engine output, .graphifyignore indexing scope, graphify install per machine and per agent (+6 more)

### Community 15 - "README_AI_AGENT.md (gateway and contract)"
Cohesion: 0.14
Nodes (15): Five-file feature pattern (keys, queries, actions, hooks, schemas), TanStack Query SSR hydration, Kanban feature (frontend), Board membership (users and groups), useBoardRealtime, Fractional-indexing positions (collate C), README.md (P3MD Social Integration), README_AI_AGENT.md (gateway and contract) (+7 more)

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
Cohesion: 0.20
Nodes (12): bun run agent:check validation, Agent history entry JSON contract (schema.json), Agent history vs agent memory, One file per session, append-only entries, Rules C-12/C-13/C-14 (truthful verification and outcome), Agent Log and session notes, Dataview queries, obsidian-out git policy (build artefact) (+4 more)

### Community 20 - "google-calendar/index.ts"
Cohesion: 0.08
Nodes (33): ref_bun_test, ref_npm_jose_5, ref_npm_supabase, admin, buildDigestPrompt(), DigestContextData, generateDailyDigestSummary(), CalendarRow (+25 more)

### Community 21 - "Supabase clients and session"
Cohesion: 0.16
Nodes (13): Conventions and guardrails, Testing layers, Notifications and PWA feature (frontend), Device support and QA, enablePush device opt-in, Notification-first PWA decision, PWA shell (manifest, sw.js), Supabase clients and session (+5 more)

### Community 22 - "agent-context.ts"
Cohesion: 0.20
Nodes (10): 3. Definitions, Agent Rules (from Contract C-03), ref_node_path, ref_node_url, build(), main(), OUT, REQUIRED (+2 more)

### Community 24 - "daily-digest (PSI-077)"
Cohesion: 0.24
Nodes (10): daily-digest (PSI-077), Deterministic Google event IDs (idempotent push), google-calendar Edge Function (/sync /push), google-drive Edge Function (/sync /file /search), Service-account token helper (google.ts), Sync style: periodic window rescan, Notification types and creators, ICS feed route /api/calendar/feed/[token] (+2 more)

### Community 26 - "reconcile"
Cohesion: 0.28
Nodes (9): costOf(), estimateFailedAttempts(), likelyBilled(), parseBillingCsv(), priceFor(), reconcile(), reconcileModels(), utcDay() (+1 more)

### Community 27 - "report.ts"
Cohesion: 0.06
Nodes (43): taskResult, attempts, auxCalls, Config, estimatedCount, finalCalls, hermes, hermesCalls (+35 more)

### Community 28 - "Tutorial · Connect the Google Calendar API (PSI-060, part 2 of 2)"
Cohesion: 0.08
Nodes (25): Finally: the app, First: is the API even enabled?, If "Create new key" is greyed out or errors, Local dev, Now delete the download, Remote project, Security rules for this task, Status columns are your diagnostics (+17 more)

### Community 29 - "ingest.ts"
Cohesion: 0.15
Nodes (14): Attempt, Call, classifyToolResult(), errorClass(), Msg, normalizeTokens(), Session, CallRow (+6 more)

### Community 30 - "C-18 Google credentials and document content stay server-side"
Cohesion: 0.25
Nodes (9): Hermes gateway security (remote shell), agent_audit_log, runTool (runtime.ts), Agent tool rules, Decision: one Google service account, Security and privacy controls, Principle: personal data minimization, C-04 Secret key never in browser-reachable code (+1 more)

### Community 31 - "Hermes observability report"
Cohesion: 0.17
Nodes (11): 10. Not available, 1. Summary, 2. Sources, joins and coverage, 4. Wasted vs successful compute, 5. Tasks, 6. Providers (Hermes key), 7. Actual vs expected cost per token, 8. Waste signals (+3 more)

### Community 32 - "C-08 Talent data is personal data under UU PDP"
Cohesion: 0.31
Nodes (9): When Hermes builds (per-task flow), Edge Function complete() adapter (llm.ts), LLM provider layer: Claude and Hermes (PSI-098), parse-cv (PSI-082), Google Cloud setup (PSI-060), Talent CVs in Drive, C-08 Talent data is personal data under UU PDP, C-15 Human gates (+1 more)

### Community 33 - "M10 · Finance (event cashflow)"
Cohesion: 0.25
Nodes (8): Activity log (M7) — must not leak amounts, Agent view (M8 pattern), Decisions, M10 · Finance (event cashflow), pgTAP (PSI-101 accept), RLS, Schema (sketch for PSI-101), The streamline this serves

### Community 34 - "agent-evaluate"
Cohesion: 0.29
Nodes (6): step(), agent-evaluate, Files, JSONL fields, Privacy (C-07, C-08, C-18), Run

### Community 35 - "Review Process & `master` Branch Convention"
Cohesion: 0.29
Nodes (6): Agent Rules (merged from Contract C-03), Branch Rule, Files, Review Document Sections, Review Gate, Review Process & `master` Branch Convention

### Community 36 - "Finance (event cashflow) and the event → board → finance streamline"
Cohesion: 0.40
Nodes (5): AI-friendly contract, Finance (event cashflow) and the event → board → finance streamline, Module layout (five-file pattern), Template parts reused, The flow a user sees

### Community 37 - "Supabase project settings"
Cohesion: 0.22
Nodes (8): Supabase Auth settings, Supabase project settings, Vault secrets and env variables, assert_admin_remains() last-admin trigger, custom_access_token_hook, effective_role_ids(), Guards (escalation, last admin, suspension, system rows), users_with_permission()

### Community 38 - "Operations and risks"
Cohesion: 0.28
Nodes (9): Onboarding Option A: email invites, Onboarding Option B: Google sign-in + allowlist, admin-users (PSI-018), Operations and risks, Free tier operations and keep-alive (PSI-092), Service quotas (Resend, Web Push, Google, Vercel), before_user_created_hook, handle_new_user() trigger (+1 more)

### Community 39 - "Agent operations README"
Cohesion: 0.33
Nodes (7): ECC Memory Vault (scratchpad handoffs), Agent operations README, Coordination rules, Handoffs (governed vs scratchpad), Builder and operator lanes, C-03 Claim before editing (one task, one agent, one branch), C-20 Memories are not facts

### Community 40 - "Supabase OAuth 2.1 server for agents (PSI-074)"
Cohesion: 0.38
Nodes (7): Shared MCP servers, /api/mcp route (mcp-handler), verifySupabaseToken (JWKS), /auth/consent page and Connected apps revoke, Supabase OAuth 2.1 server for agents (PSI-074), Open risks to verify, Read-only MCP API

### Community 41 - "/api/push/dispatch route"
Cohesion: 0.43
Nodes (7): /api/push/dispatch route, Notification-to-push flow, dispatch_push statement trigger, notifications table, notify(), push_subscriptions table, push_targets() / mark_pushed()

### Community 42 - "ref_node_fs"
Cohesion: 0.33
Nodes (5): ref_node_fs, files, index, out, SKIP

### Community 43 - "Agent tool registry (registry.ts)"
Cohesion: 0.50
Nodes (5): /api/chat route (PSI-076), defineTool / AgentTool types (define.ts), get_activity tool, Next.js model() adapter (models.ts), Agent tool registry (registry.ts)

### Community 44 - "m9-talent.md"
Cohesion: 0.80
Nodes (4): candidate_group_scores view, candidate_skills table, candidates table, Skill taxonomy tables

### Community 45 - "Historical agent work"
Cohesion: 0.40
Nodes (5): Historical agent work, Append-only entries rule, Agent history JSON entry, agent-history schema.json, Schema versioning policy

### Community 46 - "add"
Cohesion: 0.67
Nodes (4): account(), add(), buildRuns(), wasteFraction()

### Community 224 - "xref.mjs"
Cohesion: 0.14
Nodes (10): audit, ext, files, fns, known, perms, refs, tables (+2 more)

### Community 328 - "graphify architecture"
Cohesion: 0.33
Nodes (6): graphify architecture, .graphifyignore, graphify install for Claude Code and Hermes, Phase-end snapshot, Graph refresh rules, graphify-out vs docs/graphify-architecture

### Community 358 - "m6-google.md"
Cohesion: 0.31
Nodes (10): can_see_drive_root(), document_views (view log), drive_files (Drive mirror), drive_roots / drive_root_access, event_google_links table, google_calendars table, queue_google_push triggers (pg_net), pg_cron sync schedules (drive 30m, calendar 15m) (+2 more)

### Community 362 - "3. Client-by-Client Setup Guide"
Cohesion: 0.17
Nodes (12): 1. Executive Summary, 2. DCR (Dynamic Client Registration) vs CIMD (Client ID Metadata Documents), 3.1 Claude Desktop, 3.2 ChatGPT (Custom Actions & MCP), 3.3 Cursor (IDE Assistant), 3.4 Hermes Agent / Custom CLI, 3. Client-by-Client Setup Guide, 4. Security & Revocation (+4 more)

### Community 372 - "M12 + M13 · Task lifecycle, task cash and the CPM network"
Cohesion: 0.18
Nodes (11): Decisions (operator, 2026-09-29, C-15), Helper functions (all `stable security definer set search_path = ''`), M12 + M13 · Task lifecycle, task cash and the CPM network, M12 schema (sketch for PSI-115), M13 schema (sketch for PSI-116), Notifications and activity log, pgTAP (PSI-115, PSI-116 accept), RLS (+3 more)

### Community 380 - "Task lifecycle, CPM network and earned value"
Cohesion: 0.20
Nodes (10): Flow, Module layout (mirror the existing kanban/finance features), Permissions in the UI (mirror, never replace, the DB), PSI-117 · Sub-tasks and delegation, PSI-118 · Start and finish gates on drag, PSI-119 · CPM/PERT engine (`schedule/lib/pert.ts`), PSI-120 · Schedule tab and Gantt (frappe-gantt), PSI-121 · Earned value tab (recharts) (+2 more)

### Community 400 - "Phase 11 brief · kanban task → CPM network → earned value"
Cohesion: 0.29
Nodes (7): 1. The job in one paragraph, 2. Frozen decisions: do not reinterpret, 3. Glossary (with the numbers your tests must hit), 4. Order and parallel lanes, 5. Per-task traps, 6. Every session, as always, Phase 11 brief · kanban task → CPM network → earned value

### Community 420 - "Frontend architecture"
Cohesion: 0.67
Nodes (3): Decisions at a glance, Files in this folder, Frontend architecture

## Knowledge Gaps
- **268 isolated node(s):** `perMillion`, `Price`, `Tokens`, `ToolCall`, `ToolStatus` (+263 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 303 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `README_AI_AGENT.md (gateway and contract)` connect `README_AI_AGENT.md (gateway and contract)` to `List task project (PSI tasks)`, `Claude Code (builder lane) setup`, `frontend-architecture/README.md`, `m3-role-mail.md`, `Database architecture README`, `m4-calendar.md`, `System overview`, `AGENTS.md`, `Hermes Agent (operator lane) setup`, `Supabase clients and session`, `C-18 Google credentials and document content stay server-side`, `C-08 Talent data is personal data under UU PDP`, `Operations and risks`, `Agent operations README`, `Supabase OAuth 2.1 server for agents (PSI-074)`, `m9-talent.md`, `Historical agent work`, `graphify architecture`, `m6-google.md`?**
  _High betweenness centrality (0.536) - this node is a cross-community bridge._
- **Why does `List task project (PSI tasks)` connect `List task project (PSI tasks)` to `obsidian-sync.ts`, `Historical agent work`, `Hermes Agent (operator lane) setup`, `README_AI_AGENT.md (gateway and contract)`, `Agent history entry JSON contract (schema.json)`?**
  _High betweenness centrality (0.305) - this node is a cross-community bridge._
- **Why does `Integrated Obsidian (local)` connect `Hermes Agent (operator lane) setup` to `List task project (PSI tasks)`, `obsidian-sync.ts`, `Historical agent work`, `README_AI_AGENT.md (gateway and contract)`, `Agent history entry JSON contract (schema.json)`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `M1 RBAC migration doc` (e.g. with `rbac.test.sql assertions` and `Canonical graph questions`) actually correct?**
  _`M1 RBAC migration doc` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `perMillion`, `Price`, `Tokens` to the rest of the system?**
  _268 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `List task project (PSI tasks)` be split into smaller, more focused modules?**
  _Cohesion score 0.06511746680286006 - nodes in this community are weakly interconnected._
- **Should `Claude Code (builder lane) setup` be split into smaller, more focused modules?**
  _Cohesion score 0.14705882352941177 - nodes in this community are weakly interconnected._