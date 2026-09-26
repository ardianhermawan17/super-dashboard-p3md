-- PSI-071 · Migration M8: Agent layer — views, audit log, digests
-- Read models for MCP tools plus the audit trail and digest store.
-- Spec: docs/database-architecture/m8-agent-layer.md
--
-- Every view is `security_invoker = true`: without it a view executes as its owner
-- (postgres) and silently bypasses the caller's RLS, leaking every row.

-- ============================================================================
-- 1. Read views — caller's RLS applies
-- ============================================================================

-- Board status: per-column task counts and overdue counts.
create or replace view public.agent_board_status
with (security_invoker = true) as
select
  b.id as board_id,
  b.name as board,
  c.id as column_id,
  c.title as column_title,
  c.position,
  c.is_done,
  count(t.id) as task_count,
  count(t.id) filter (
    where not c.is_done
      and t.due_date < (now() at time zone 'Asia/Jakarta')::date
  ) as overdue_count
from public.boards b
join public.board_columns c on c.board_id = b.id
left join public.tasks t on t.column_id = c.id
group by b.id, b.name, c.id, c.title, c.position, c.is_done;

-- Agenda: events with their audience as role/group slugs plus direct invitee count.
create or replace view public.agent_agenda
with (security_invoker = true) as
select
  e.id,
  e.title,
  e.starts_at,
  e.ends_at,
  e.all_day,
  e.location,
  e.rrule,
  e.source,
  coalesce(array_agg(distinct r.slug) filter (where r.slug is not null), '{}') as audience_roles,
  coalesce(array_agg(distinct g.slug) filter (where g.slug is not null), '{}') as audience_groups,
  count(a.user_id) as direct_invitees
from public.events e
left join public.event_audience a on a.event_id = e.id
left join public.roles r on r.id = a.role_id
left join public.groups g on g.id = a.group_id
group by e.id, e.title, e.starts_at, e.ends_at, e.all_day, e.location, e.rrule, e.source;

-- Inbox: only messages that actually left the building, trimmed to a snippet.
create or replace view public.agent_inbox
with (security_invoker = true) as
select
  m.id,
  coalesce(r.slug, 'group:' || g.slug) as target,
  m.subject,
  left(m.body_md, 280) as snippet,
  m.status,
  m.sent_at,
  m.created_at
from public.messages m
left join public.roles r on r.id = m.to_role_id
left join public.groups g on g.id = m.to_group_id
where m.status in ('sent', 'failed');

-- Documents: metadata only, never content (contract C-18). Folders excluded.
create or replace view public.agent_documents
with (security_invoker = true) as
select
  f.id,
  f.name,
  f.path,
  f.mime_type,
  f.modified_at,
  r.name as root
from public.drive_files f
join public.drive_roots r on r.id = f.root_id
where f.mime_type <> 'application/vnd.google-apps.folder';

-- ============================================================================
-- 2. Audit log — one row per agent tool call
-- ============================================================================

create table if not exists public.agent_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- OAuth client id, or 'in-app' for the assistant inside the dashboard.
  client_id text not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  rows_returned int,
  duration_ms int,
  error text,
  -- Non-negative where present; NULL means "not measured".
  constraint agent_audit_log_rows_returned_non_negative
    check (rows_returned is null or rows_returned >= 0),
  constraint agent_audit_log_duration_ms_non_negative
    check (duration_ms is null or duration_ms >= 0)
);

create index if not exists idx_agent_audit_log_client_time
  on public.agent_audit_log (client_id, occurred_at desc);
create index if not exists idx_agent_audit_log_user_time
  on public.agent_audit_log (user_id, occurred_at desc);

alter table public.agent_audit_log enable row level security;

-- Read your own calls, or all of them with agent.audit.
drop policy if exists "own agent calls readable" on public.agent_audit_log;
create policy "own agent calls readable" on public.agent_audit_log
  for select to authenticated using (
    user_id = (select auth.uid())
    or (select public.has_permission('agent.audit'))
  );

-- Insert only as yourself: a client cannot forge another user's call log.
drop policy if exists "agent calls logged as self" on public.agent_audit_log;
create policy "agent calls logged as self" on public.agent_audit_log
  for insert to authenticated with check (user_id = (select auth.uid()));

-- No update/delete policy: the audit trail is append-only for everyone.

-- ============================================================================
-- 3. Digests
-- ============================================================================

create table if not exists public.digests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  content_md text not null,
  model text not null,
  constraint digests_period_ordered check (period_end > period_start)
);

create index if not exists idx_digests_created_at on public.digests (created_at desc);

alter table public.digests enable row level security;

-- Readable only with digest.receive or agent.audit. No write policy: digests are
-- produced server-side by a service-role job, never by a client.
drop policy if exists "digests for receivers" on public.digests;
create policy "digests for receivers" on public.digests
  for select to authenticated using (
    (select public.has_permission('digest.receive'))
    or (select public.has_permission('agent.audit'))
  );

-- ============================================================================
-- 4. Grants
-- ============================================================================

-- Views are read-only surfaces; RLS still filters rows for `authenticated`.
grant select on public.agent_board_status to authenticated;
grant select on public.agent_agenda to authenticated;
grant select on public.agent_inbox to authenticated;
grant select on public.agent_documents to authenticated;

-- Audit: insert + select only. Append-only by construction.
grant select, insert on public.agent_audit_log to authenticated;
-- The identity column needs a sequence grant or inserts fail after the first row.
grant usage, select on sequence public.agent_audit_log_id_seq to authenticated;

grant select on public.digests to authenticated;