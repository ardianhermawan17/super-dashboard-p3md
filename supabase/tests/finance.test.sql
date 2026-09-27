-- PSI-101 · pgTAP for M10 finance (docs/database-architecture/m10-finance.md, "pgTAP" section)
-- Seed users: ...01 member1 (treasurer, board member), ...02 admin (finance.manage via admin),
-- ...03 member2 (board member, no finance permission), ...04 member3 (finance.read, not a member).
begin;
select plan(37);

-- ---------------------------------------------------------------- fixtures (as postgres)
insert into public.roles (id, slug, name) values
  ('a1000000-0000-4000-8000-000000000001', 'test-treasurer', 'Test treasurer'),
  ('a1000000-0000-4000-8000-000000000002', 'test-finance-reader', 'Test finance reader');
insert into public.role_permissions (role_id, permission_key) values
  ('a1000000-0000-4000-8000-000000000001', 'finance.read'),
  ('a1000000-0000-4000-8000-000000000001', 'finance.write'),
  ('a1000000-0000-4000-8000-000000000002', 'finance.read');
insert into public.user_roles (user_id, role_id) values
  ('00000000-0000-0000-0000-000000000001', 'a1000000-0000-4000-8000-000000000001'),
  ('00000000-0000-0000-0000-000000000004', 'a1000000-0000-4000-8000-000000000002');

insert into public.events (id, title, starts_at, ends_at, created_by) values
  ('e1000000-0000-4000-8000-000000000001', 'Event President', '2026-08-17 01:00:00+00', '2026-08-17 05:00:00+00',
   '00000000-0000-0000-0000-000000000003'),
  ('e2000000-0000-4000-8000-000000000002', 'Another event', '2026-09-01 01:00:00+00', '2026-09-01 02:00:00+00',
   '00000000-0000-0000-0000-000000000003');

-- Board B belongs to the event; member2 creates it (auto-member), member1 is added. Admin is not a member.
insert into public.boards (id, name, created_by, event_id) values
  ('b1000000-0000-4000-8000-000000000001', 'Event President', '00000000-0000-0000-0000-000000000003',
   'e1000000-0000-4000-8000-000000000001'),
  ('b2000000-0000-4000-8000-000000000002', 'Other board', '00000000-0000-0000-0000-000000000004', null),
  ('b3000000-0000-4000-8000-000000000003', 'Treasurer scratch board', '00000000-0000-0000-0000-000000000001', null);
insert into public.board_members (board_id, user_id) values
  ('b1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000001');
insert into public.board_columns (id, board_id, title, position) values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'To do', 'a0'),
  ('c2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'To do', 'a0');
insert into public.tasks (id, board_id, column_id, title, position, created_by) values
  ('d1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'c1000000-0000-4000-8000-000000000001', 'Book the venue', 'a0', '00000000-0000-0000-0000-000000000003'),
  ('d2000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002',
   'c2000000-0000-4000-8000-000000000002', 'Unrelated task', 'a0', '00000000-0000-0000-0000-000000000004');

-- ---------------------------------------------------------------- schema and seed
select is((select count(*) from public.permissions where key like 'finance.%'), 3::bigint,
  'three finance permission keys exist');
select ok(exists (select 1 from public.role_permissions rp join public.roles r on r.id = rp.role_id
                  where r.slug = 'admin' and rp.permission_key = 'finance.manage'),
  'admin holds finance.manage');
select ok((select count(*) from public.finance_categories) >= 11, 'default categories are seeded');
select throws_ok(
  $$ insert into public.boards (name, created_by, event_id)
     values ('Second board', '00000000-0000-0000-0000-000000000003', 'e1000000-0000-4000-8000-000000000001') $$,
  '23505', null, 'an event can have only one board');

-- ---------------------------------------------------------------- treasurer on the event board
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into public.finance_entries (id, board_id, task_id, category_id, direction, amount, description, occurred_on)
     values ('f1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
             'd1000000-0000-4000-8000-000000000001',
             (select id from public.finance_categories where slug = 'venue'), 'outflow', 2000000, 'Venue deposit', '2026-08-01') $$,
  'treasurer records an outflow on the event board');
select is((select event_id from public.finance_entries where id = 'f1000000-0000-4000-8000-000000000001'),
  'e1000000-0000-4000-8000-000000000001'::uuid, 'the entry inherits the board''s event');
select lives_ok(
  $$ insert into public.finance_entries (id, board_id, category_id, direction, amount, description, occurred_on)
     values ('f2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
             (select id from public.finance_categories where slug = 'sponsorship'), 'inflow', 1200000, 'Sponsor A', '2026-08-02') $$,
  'treasurer records an inflow');
select throws_ok(
  $$ insert into public.finance_entries (board_id, task_id, category_id, direction, amount, description)
     values ('b1000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000002',
             (select id from public.finance_categories where slug = 'venue'), 'outflow', 10, 'Wrong task') $$,
  '23514', null, 'a task from another board is rejected');
select throws_ok(
  $$ insert into public.finance_entries (board_id, category_id, direction, amount, description)
     values ('b1000000-0000-4000-8000-000000000001',
             (select id from public.finance_categories where slug = 'venue'), 'inflow', 10, 'Wrong direction') $$,
  '23514', null, 'a category of the other direction is rejected');
select throws_ok(
  $$ insert into public.finance_entries (board_id, category_id, direction, amount, description)
     values ('b1000000-0000-4000-8000-000000000001',
             (select id from public.finance_categories where slug = 'other'), 'outflow', 0, 'Zero') $$,
  '23514', null, 'a zero amount is rejected');
select throws_ok(
  $$ insert into public.finance_entries (board_id, category_id, direction, amount, description, currency)
     values ('b1000000-0000-4000-8000-000000000001',
             (select id from public.finance_categories where slug = 'other'), 'outflow', 5, 'Dollars', 'USD') $$,
  '23514', null, 'a currency other than IDR is rejected');
select throws_ok(
  $$ insert into public.finance_entries (board_id, category_id, direction, amount, description)
     values ('b2000000-0000-4000-8000-000000000002',
             (select id from public.finance_categories where slug = 'other'), 'outflow', 5, 'Not my board') $$,
  '42501', null, 'a treasurer cannot write to a board they are not on');
select lives_ok(
  $$ update public.finance_entries set amount = 2100000 where id = 'f1000000-0000-4000-8000-000000000001' $$,
  'treasurer edits an entry');
select throws_ok(
  $$ update public.finance_entries set event_id = 'e2000000-0000-4000-8000-000000000002'
     where id = 'f1000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'an update cannot point an entry at another event');
select lives_ok(
  $$ update public.finance_entries set board_id = 'b3000000-0000-4000-8000-000000000003'
     where id = 'f2000000-0000-4000-8000-000000000002' $$,
  'an entry can move to another board the treasurer is on');
select is((select event_id from public.finance_entries where id = 'f2000000-0000-4000-8000-000000000002'), null::uuid,
  'moving to a board without an event clears the event');
select lives_ok(
  $$ update public.finance_entries set board_id = 'b1000000-0000-4000-8000-000000000001'
     where id = 'f2000000-0000-4000-8000-000000000002' $$,
  'the entry moves back to the event board');
select is((select event_id from public.finance_entries where id = 'f2000000-0000-4000-8000-000000000002'),
  'e1000000-0000-4000-8000-000000000001'::uuid, 'moving onto an event board takes that board''s event');
select ok((select count(*) from public.finance_categories) >= 11, 'a finance user reads the categories');
select throws_ok(
  $$ insert into public.finance_categories (slug, name) values ('rogue', 'Rogue') $$,
  '42501', null, 'finance.write alone cannot create categories');
select is((select count(*) from public.finance_entries), 2::bigint, 'treasurer sees the board''s two entries');
select is((select count(*) from public.agent_finance where board_id = 'b1000000-0000-4000-8000-000000000001'), 2::bigint,
  'agent_finance returns one row per direction and category');
select ok((select count(*) from public.activity_log where entity_type = 'finance') >= 3,
  'treasurer sees the finance activity (2 created + 1 updated)');
select ok((select summary from public.activity_log where entity_type = 'finance' and verb = 'created'
           and entity_id = 'f1000000-0000-4000-8000-000000000001') = 'Outflow of Rp 2.000.000 created (Venue) on Event President',
  'activity summary is one sentence with a formatted amount and no names');

-- ---------------------------------------------------------------- board member without finance permission
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*) from public.finance_entries), 0::bigint, 'a board member without finance.read sees no entries');
select is((select count(*) from public.finance_categories), 0::bigint, 'nor the categories');
select is((select count(*) from public.agent_finance), 0::bigint, 'nor any agent_finance totals');
select is((select count(*) from public.activity_log where entity_type = 'finance'), 0::bigint,
  'nor any finance activity (no amount leak through the feed)');
select throws_ok(
  $$ insert into public.finance_entries (board_id, category_id, direction, amount, description)
     values ('b1000000-0000-4000-8000-000000000001',
             (select id from public.finance_categories where slug = 'other'), 'outflow', 5, 'No permission') $$,
  '42501', null, 'a board member without finance.write cannot record');

-- ---------------------------------------------------------------- finance.read but not a member
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from public.finance_entries), 0::bigint, 'finance.read without board membership sees nothing');

-- ---------------------------------------------------------------- finance.manage (admin, not a member)
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*) from public.finance_entries), 2::bigint, 'finance.manage sees every ledger');
select lives_ok(
  $$ insert into public.finance_categories (slug, name, direction) values ('test-grant', 'Test grant', 'inflow') $$,
  'finance.manage creates a category');
select lives_ok(
  $$ insert into public.finance_entries (board_id, category_id, direction, amount, description)
     values ('b1000000-0000-4000-8000-000000000001',
             (select id from public.finance_categories where slug = 'test-grant'), 'inflow', 500000, 'Grant') $$,
  'finance.manage records on a board it is not a member of');

-- ---------------------------------------------------------------- anon
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*) from public.finance_entries), 0::bigint, 'anon reads no entries');

-- ---------------------------------------------------------------- cascades (as postgres)
reset role;
delete from public.events where id = 'e1000000-0000-4000-8000-000000000001';
select is((select count(*) from public.finance_entries
           where board_id = 'b1000000-0000-4000-8000-000000000001' and event_id is null), 3::bigint,
  'deleting the event keeps the board and its entries (event_id cleared)');
select is((select event_id from public.boards where id = 'b1000000-0000-4000-8000-000000000001'), null::uuid,
  'deleting the event unlinks the board');
-- The task goes first: deleting a board that still has tasks hits a pre-existing M7 bug (PSI-107).
delete from public.tasks where board_id = 'b1000000-0000-4000-8000-000000000001';
delete from public.boards where id = 'b1000000-0000-4000-8000-000000000001';
select is((select count(*) from public.finance_entries where board_id = 'b1000000-0000-4000-8000-000000000001'), 0::bigint,
  'deleting the board removes its entries');

select * from finish();
rollback;
