-- ============================================================
-- supabase/tests/activity_log.test.sql — M7 Activity Log tests (PSI-070)
-- ============================================================

begin;
select plan(9);

set local role postgres;

-- 1. Table structure and RLS verification
select has_table('public', 'activity_log', 'public.activity_log table exists');
select is(
  (select c.relrowsecurity from pg_class c where c.relname = 'activity_log' and c.relnamespace = 'public'::regnamespace),
  true,
  'RLS is enabled on activity_log'
);

-- Setup test users & board
insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'bob@test.local');

-- Assign Alice admin role so she has calendar.write and all permissions
insert into public.user_roles (user_id, role_id)
values ('11111111-1111-1111-1111-111111111111', (select id from public.roles where slug = 'admin'));

-- Create a test board owned by Alice
insert into public.boards (id, name, created_by)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Product Roadmap', '11111111-1111-1111-1111-111111111111');

-- Columns
insert into public.board_columns (id, board_id, title, position)
values
  ('cccccccc-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Backlog', 'a0'),
  ('cccccccc-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'In Progress', 'a1');

-- 2. Task insert creates 'created' activity log
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

insert into public.tasks (id, board_id, column_id, title, position)
values ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-1111-1111-1111-111111111111', 'Design Landing Page', 'p0');

select results_eq(
  $$ select verb, summary from public.activity_log where entity_id = '33333333-3333-3333-3333-333333333333' order by id desc limit 1 $$,
  $$ values ('created', 'Task "Design Landing Page" created') $$,
  'Task insert produces created activity log'
);

-- 3. Task column move creates 'moved' activity log
update public.tasks
set column_id = 'cccccccc-2222-2222-2222-222222222222'
where id = '33333333-3333-3333-3333-333333333333';

select results_eq(
  $$ select verb, summary from public.activity_log where entity_id = '33333333-3333-3333-3333-333333333333' order by id desc limit 1 $$,
  $$ values ('moved', 'Task "Design Landing Page" moved to In Progress') $$,
  'Task column move produces moved activity log with target column'
);

-- 4. Task position change ONLY is suppressed
update public.tasks
set position = 'p1'
where id = '33333333-3333-3333-3333-333333333333';

select results_eq(
  $$ select count(*)::int from public.activity_log where entity_id = '33333333-3333-3333-3333-333333333333' $$,
  $$ values (2) $$,
  'Task reorder within column does NOT create extra activity log'
);

-- 5. Event insert creates 'created' activity log when source = app
insert into public.events (id, title, starts_at, ends_at, source, created_by)
values ('44444444-4444-4444-4444-444444444444', 'Sprint Retro', '2026-10-01 10:00:00+07', '2026-10-01 11:00:00+07', 'app', '11111111-1111-1111-1111-111111111111');

select is(
  (select verb from public.activity_log where entity_id = '44444444-4444-4444-4444-444444444444'),
  'created',
  'App event insert produces created activity log'
);

-- 6. External Google event import is ignored (inserted via postgres service role)
set local role postgres;
insert into public.events (id, title, starts_at, ends_at, source, created_by)
values ('55555555-5555-5555-5555-555555555555', 'Google Calendar Meet', '2026-10-01 14:00:00+07', '2026-10-01 15:00:00+07', 'google', '11111111-1111-1111-1111-111111111111');

select is(
  (select count(*)::int from public.activity_log where entity_id = '55555555-5555-5555-5555-555555555555'),
  0,
  'External Google event import is ignored by activity logger'
);

-- 7. Message status update to 'sent' produces message activity log
set local role postgres;
insert into public.roles (id, slug, name, description, is_system)
values ('66666666-6666-6666-6666-666666666666', 'marketing', 'Marketing Team', 'Testing message log', false);

insert into public.messages (id, sender_id, to_role_id, subject, body_md, status)
values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', 'Q3 Launch', 'Body text', 'draft');

-- Update status to sent
update public.messages
set status = 'sent'
where id = '77777777-7777-7777-7777-777777777777';

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);

select results_eq(
  $$ select verb, summary from public.activity_log where entity_id = '77777777-7777-7777-7777-777777777777' $$,
  $$ values ('sent', 'Mail "Q3 Launch" sent to marketing') $$,
  'Message status change to sent produces activity log with role slug'
);

-- 8. RLS prevents unauthorized outsider from seeing Alice board activity
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);

select is(
  (select count(*)::int from public.activity_log where board_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0,
  'Non-board-member Bob cannot see Alice board activity log'
);

select * from finish();
rollback;
