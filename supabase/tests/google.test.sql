-- ============================================================
-- supabase/tests/google.test.sql — Google Workspace & Drive RLS tests (PSI-061 & PSI-065)
-- ============================================================

begin;
select plan(13);

-- Setup test fixtures as postgres
set local role postgres;

-- Create test role and assign to member1
insert into public.roles (id, slug, name, description, is_system)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'finance-team', 'Finance Team', 'Testing Drive RLS', false);

-- Create test Drive root 1 (restricted to finance-team role)
insert into public.drive_roots (id, folder_id, name, enabled)
values ('11111111-1111-1111-1111-111111111111', 'folder_finance_123', 'Finance Documents', true);

insert into public.drive_root_access (root_id, role_id)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- Create test file under root 1
insert into public.drive_files (id, root_id, name, mime_type, path)
values ('file_finance_001', '11111111-1111-1111-1111-111111111111', 'q3-report.pdf', 'application/pdf', 'Finance/q3-report.pdf');

-- Create test Drive root 2 (restricted to engineering - no members here)
insert into public.roles (id, slug, name, description, is_system)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'engineering-team', 'Engineering Team', 'Testing Drive RLS', false);

insert into public.drive_roots (id, folder_id, name, enabled)
values ('22222222-2222-2222-2222-222222222222', 'folder_eng_456', 'Engineering Blueprints', true);

insert into public.drive_root_access (root_id, role_id)
values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

insert into public.drive_files (id, root_id, name, mime_type, path)
values ('file_eng_001', '22222222-2222-2222-2222-222222222222', 'architecture.pdf', 'application/pdf', 'Eng/architecture.pdf');

-- Assign finance-team role to member1 (00000000-0000-0000-0000-000000000001)
insert into public.user_roles (user_id, role_id)
values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ------------------------------------------------------------
-- 1. Member1 (finance role) can see Finance root and file, but NOT Engineering
-- ------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.drive_roots),
  1::bigint,
  'member1 sees only roots they have role/group access to'
);

select is(
  (select count(*) from public.drive_files),
  1::bigint,
  'member1 sees only files in roots they have access to'
);

select is(
  (select id from public.drive_files),
  'file_finance_001',
  'member1 sees exactly file_finance_001'
);

-- ------------------------------------------------------------
-- 2. Member3 has no access to any root
-- ------------------------------------------------------------
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*) from public.drive_roots),
  0::bigint,
  'user without root access sees 0 drive roots'
);

select is(
  (select count(*) from public.drive_files),
  0::bigint,
  'user without root access sees 0 drive files'
);

-- ------------------------------------------------------------
-- 3. Document view logging & audit policies
-- ------------------------------------------------------------
select lives_ok(
  $$ insert into public.document_views (user_id, file_id)
     values ('00000000-0000-0000-0000-000000000004', 'file_finance_001') $$,
  'authenticated user can log their own document view'
);

select is(
  (select count(*) from public.document_views),
  1::bigint,
  'authenticated user can only read their own document views'
);

-- ------------------------------------------------------------
-- 4. Calendar XOR constraint on google_calendars (role_id vs group_id)
-- ------------------------------------------------------------
reset role;
select throws_ok(
  $$ insert into public.google_calendars (calendar_id, name, direction, role_id, group_id)
     values ('test@cal.google.com', 'Invalid Cal', 'pull', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222') $$,
  '23514',
  null,
  'check constraint rejects google_calendars with both role and group'
);

-- ------------------------------------------------------------
-- 5. PSI-065: upsert_google_event and prune_google_events RPCs
-- ------------------------------------------------------------
-- Setup valid linked calendar targeting finance-team role
insert into public.google_calendars (id, calendar_id, name, direction, role_id, enabled)
values ('33333333-3333-3333-3333-333333333333', 'finance-cal@group.calendar.google.com', 'Finance Calendar', 'pull', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);

-- Call upsert_google_event as service_role
set local role service_role;
select lives_ok(
  $$ select public.upsert_google_event(
       'finance-cal@group.calendar.google.com',
       'g_evt_100',
       'Q3 Budget Review',
       'Quarterly finance sync',
       'Boardroom A',
       '2026-10-15 09:00:00+07'::timestamptz,
       '2026-10-15 10:00:00+07'::timestamptz,
       false,
       null,
       'https://calendar.google.com/event?eid=100'
     ) $$,
  'upsert_google_event inserts pulled event'
);

-- Verify event properties created by pull
select results_eq(
  $$ select title, source, created_by is null from public.events where title = 'Q3 Budget Review' $$,
  $$ values ('Q3 Budget Review', 'google', true) $$,
  'pulled event has source=google and created_by=null'
);

-- Verify link created
select is(
  (select google_calendar_id from public.event_google_links where google_event_id = 'g_evt_100'),
  'finance-cal@group.calendar.google.com',
  'event_google_links record established'
);

-- Verify audience visibility: member1 (finance role) can see the pulled event
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*) from public.events where title = 'Q3 Budget Review'),
  1::bigint,
  'member1 (finance role) sees pulled finance calendar event'
);

-- Member3 (no finance role) cannot see the pulled event
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}';

select is(
  (select count(*) from public.events where title = 'Q3 Budget Review'),
  0::bigint,
  'member3 without finance role cannot see pulled finance event'
);

select * from finish();
rollback;
