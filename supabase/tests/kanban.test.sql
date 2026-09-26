begin;
select plan(7);

-- 1. Plain user without kanban.write cannot create boards
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(public.has_permission('kanban.write'), false, 'user without kanban.write permission returns false');

select throws_ok(
  $$ insert into public.boards (name, created_by)
     values ('Unauthorized Board', '00000000-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'insert into boards without kanban.write is rejected by RLS'
);

-- 2. Check task priority constraint
reset role;

select throws_ok(
  $$ insert into public.tasks (board_id, column_id, title, priority, position, created_by)
     values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Task 1', 'invalid_priority', 'a0', '00000000-0000-0000-0000-000000000001') $$,
  '23514',
  null,
  'check constraint rejects invalid task priority'
);

-- 3. Board creator auto-member trigger
select lives_ok(
  $$ insert into public.boards (id, name, created_by)
     values ('11111111-1111-1111-1111-111111111111', 'Project Alpha', '00000000-0000-0000-0000-000000000001') $$,
  'service role can create board'
);

select is(
  (select count(*) from public.board_members where board_id = '11111111-1111-1111-1111-111111111111' and user_id = '00000000-0000-0000-0000-000000000001'),
  1::bigint,
  'board creator is automatically added to board_members'
);

-- 4. is_board_member helper
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  public.is_board_member('11111111-1111-1111-1111-111111111111'),
  true,
  'board creator is recognized as board member'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  public.is_board_member('11111111-1111-1111-1111-111111111111'),
  false,
  'non-member user is not recognized as board member'
);

select * from finish();
rollback;
