# M8 · Agent layer

> **Scope:** `security_invoker` views for agent tools, the agent audit log, digests.
> Tools: [agent-layer-mcp.md](../backend-architecture/agent-layer-mcp.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

Views use `security_invoker = true` so the **caller's** RLS applies. Without it a view runs as its owner and leaks everything.

```sql
create view public.agent_board_status with (security_invoker = true) as
select b.id as board_id, b.name as board, c.title as column_title, c.position,
       count(t.id) as task_count,
       count(t.id) filter (
         where not c.is_done and t.due_date < (now() at time zone 'Asia/Jakarta')::date) as overdue_count
  from public.boards b
  join public.board_columns c on c.board_id = b.id
  left join public.tasks t on t.column_id = c.id
 group by b.id, b.name, c.id, c.title, c.position;

create view public.agent_agenda with (security_invoker = true) as
select e.id, e.title, e.starts_at, e.ends_at, e.all_day, e.location, e.rrule, e.source,
       coalesce(array_agg(distinct r.slug) filter (where r.slug is not null), '{}') as audience_roles,
       coalesce(array_agg(distinct g.slug) filter (where g.slug is not null), '{}') as audience_groups,
       count(a.user_id) as direct_invitees
  from public.events e
  left join public.event_audience a on a.event_id = e.id
  left join public.roles r on r.id = a.role_id
  left join public.groups g on g.id = a.group_id
 group by e.id;

create view public.agent_inbox with (security_invoker = true) as
select m.id, coalesce(r.slug, 'group:' || g.slug) as target, m.subject,
       left(m.body_md, 280) as snippet, m.status, m.sent_at, m.created_at
  from public.messages m
  left join public.roles r on r.id = m.to_role_id
  left join public.groups g on g.id = m.to_group_id
 where m.status in ('sent', 'failed');

-- Metadata only: never content (C-18).
create view public.agent_documents with (security_invoker = true) as
select f.id, f.name, f.path, f.mime_type, f.modified_at, r.name as root
  from public.drive_files f join public.drive_roots r on r.id = f.root_id
 where f.mime_type <> 'application/vnd.google-apps.folder';

create table public.agent_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  client_id text not null,                       -- OAuth client id, or 'in-app'
  user_id uuid not null default auth.uid() references auth.users(id),
  tool text not null,
  args jsonb not null default '{}'::jsonb,
  rows_returned int,
  duration_ms int,
  error text
);
create index on public.agent_audit_log (client_id, occurred_at desc);
alter table public.agent_audit_log enable row level security;
create policy "own agent calls readable" on public.agent_audit_log for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('agent.audit')));
create policy "agent calls logged as self" on public.agent_audit_log for insert to authenticated
  with check (user_id = (select auth.uid()));

create table public.digests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  period_start timestamptz not null,
  period_end timestamptz not null,
  content_md text not null,
  model text not null
);
alter table public.digests enable row level security;
create policy "digests for receivers" on public.digests for select to authenticated
  using ((select public.has_permission('digest.receive')) or (select public.has_permission('agent.audit')));
```
