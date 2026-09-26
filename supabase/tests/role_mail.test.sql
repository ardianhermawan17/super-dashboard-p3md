begin;
select plan(5);

-- Check that plain authenticated user without mail.send cannot insert messages
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(public.has_permission('mail.send'), false, 'user without mail.send permission returns false');

select throws_ok(
  $$ insert into public.messages (to_role_id, subject, status)
     values ('00000000-0000-0000-0000-0000000000a1', 'test message', 'queued') $$,
  '42501',
  null,
  'insert into messages without mail.send is rejected by RLS'
);

select throws_ok(
  $$ select * from public.mail_recipients('00000000-0000-0000-0000-0000000000a1', null) $$,
  '42501',
  null,
  'mail_recipients is not executable by authenticated role'
);

-- Check recipient count is callable by authenticated
select lives_ok(
  $$ select public.mail_recipient_count('00000000-0000-0000-0000-0000000000a1', null) $$,
  'mail_recipient_count is callable by authenticated role'
);

-- Check check constraint rejects both or neither target
reset role;
select throws_ok(
  $$ insert into public.messages (sender_id, to_role_id, to_group_id, subject)
     values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'invalid') $$,
  '23514',
  null,
  'check constraint rejects message targeting both role and group'
);

select * from finish();
rollback;
