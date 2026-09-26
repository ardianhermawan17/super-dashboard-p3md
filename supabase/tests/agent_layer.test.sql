-- ============================================================
-- supabase/tests/agent_layer.test.sql — M8 Agent layer tests (PSI-071)
-- Covers: view transparency (security_invoker), audit log scoping, digest access.
-- ============================================================

begin;
select plan(17);

set local role postgres;

-- 1. All four views exist and are security_invoker (the whole point of M8).
select has_view('public', 'agent_board_status', 'agent_board_status view exists');
select has_view('public', 'agent_agenda', 'agent_agenda view exists');
select has_view('public', 'agent_inbox', 'agent_inbox view exists');
select has_view('public', 'agent_documents', 'agent_documents view exists');

select is(
  (select count(*)::int from pg_class c
   where c.relname in ('agent_board_status', 'agent_agenda', 'agent_inbox', 'agent_documents')
     and c.relnamespace = 'public'::regnamespace
     and (c.reloptions::text[] @> array['security_invoker=true'])),
  4,
  'every agent view is security_invoker = true'
);

-- 2. New tables exist with RLS on.
select has_table('public', 'agent_audit_log', 'agent_audit_log table exists');
select has_table('public', 'digests', 'digests table exists');
select is(
  (select c.relrowsecurity from pg_class c
   where c.relname = 'agent_audit_log' and c.relnamespace = 'public'::regnamespace),
  true,
  'RLS is enabled on agent_audit_log'
);
select is(
  (select c.relrowsecurity from pg_class c
   where c.relname = 'digests' and c.relnamespace = 'public'::regnamespace),
  true,
  'RLS is enabled on digests'
);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email)
values
  ('a1111111-1111-1111-1111-111111111111', 'mem@test.local'),
  ('b2222222-2222-2222-2222-222222222222', 'out@test.local');

-- Member gets a role so is_board_member returns true.
insert into public.user_roles (user_id, role_id)
values ('a1111111-1111-1111-1111-111111111111', (select id from public.roles where slug = 'admin'));

insert into public.boards (id, name, created_by)
values ('aaaaaaaa-1111-1111-1111-111111111111', 'Agent Board', 'a1111111-1111-1111-1111-111111111111');

insert into public.board_columns (id, board_id, title, position)
values ('cccccccc-1111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-111111111111', 'Todo', 'a0');

-- An overdue task (due yesterday in Jakarta) and a future one.
insert into public.tasks (id, board_id, column_id, title, position, due_date, created_by)
values
  ('d1111111-1111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-111111111111',
   'cccccccc-1111-1111-1111-111111111111', 'Overdue task', 'p0',
   ((now() at time zone 'Asia/Jakarta')::date - 1), 'a1111111-1111-1111-1111-111111111111'),
  ('d2222222-2222-2222-2222-222222222222', 'aaaaaaaa-1111-1111-1111-111111111111',
   'cccccccc-1111-1111-1111-111111111111', 'Future task', 'p1',
   ((now() at time zone 'Asia/Jakarta')::date + 7), 'a1111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------- member sees rows
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'a1111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

-- 11. Board status: 2 tasks, 1 overdue.
select results_eq(
  $$ select task_count::int, overdue_count::int from public.agent_board_status 
     where board_id = 'aaaaaaaa-1111-1111-1111-111111111111' $$,
  $$ values (2, 1) $$,
  'member sees board counts through agent_board_status'
);

-- 12. Audit log: can insert as self, and read it back.
insert into public.agent_audit_log (client_id, tool, args, rows_returned, duration_ms)
values ('in-app', 'get_board', '{"board_id":"aaaaaaaa-1111-1111-1111-111111111111"}'::jsonb, 2, 12);

select results_eq(
  $$ select tool, rows_returned from public.agent_audit_log
     where user_id = 'a1111111-1111-1111-1111-111111111111' $$,
  $$ values ('get_board', 2) $$,
  'audit row is readable by the user who wrote it'
);

-- 13. Cannot forge another user's audit row.
select throws_ok(
  $$ insert into public.agent_audit_log (client_id, user_id, tool)
     values ('in-app', 'b2222222-2222-2222-2222-222222222222', 'get_board') $$,
  '42501',
  null,
  'cannot insert an audit row attributed to another user'
);

-- ---------------------------------------------------------------- non-member sees nothing
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'b2222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.agent_board_status),
  0,
  'non-member sees NO rows through agent_board_status (security_invoker holds)'
);

select is(
  (select count(*)::int from public.agent_agenda),
  0,
  'non-member sees NO rows through agent_agenda'
);

select is(
  (select count(*)::int from public.agent_inbox),
  0,
  'non-member sees NO rows through agent_inbox'
);

select is(
  (select count(*)::int from public.agent_audit_log),
  0,
  'non-member cannot read another user''s audit rows'
);

-- 16. Digests: a plain user without digest.receive / agent.audit sees nothing.
set local role postgres;
insert into public.digests (period_start, period_end, content_md, model)
values (now() - interval '1 day', now(), '# Digest', 'test-model');

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'b2222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.digests),
  0,
  'digest is hidden without digest.receive or agent.audit'
);

select * from finish();
rollback;