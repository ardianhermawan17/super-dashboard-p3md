begin;
select plan(5);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- 1. Insert into events without calendar.write permission is rejected
select is(public.has_permission('calendar.write'), false, 'user without calendar.write permission returns false');

select throws_ok(
  $$ insert into public.events (title, starts_at, ends_at)
     values ('Unauthorized Meeting', now(), now() + interval '1 hour') $$,
  '42501',
  null,
  'insert into events without calendar.write is rejected by RLS'
);

-- 2. Service role functions are blocked from authenticated
select throws_ok(
  $$ select * from public.event_audience_user_ids('00000000-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'event_audience_user_ids is not executable by authenticated role'
);

select throws_ok(
  $$ select * from public.events_for_user('00000000-0000-0000-0000-000000000001', now(), now() + interval '1 day') $$,
  '42501',
  null,
  'events_for_user is not executable by authenticated role'
);

-- 3. Audience XOR check constraint
reset role;
select throws_ok(
  $$ insert into public.event_audience (event_id, user_id, role_id)
     values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1') $$,
  '23514',
  null,
  'check constraint rejects event_audience having multiple target types'
);

select * from finish();
rollback;
