\set VERBOSITY terse
\pset pager off
\pset tuples_only on
\pset format unaligned

-- ---- fixtures (as postgres): users fire handle_new_user -> profile + all-members
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-1111111111a1', 'a@t.test'),
  ('11111111-1111-1111-1111-1111111111b1', 'b@t.test'),
  ('11111111-1111-1111-1111-1111111111c1', 'c@t.test'),
  ('11111111-1111-1111-1111-1111111111d1', 'd@t.test');
\echo @@F profiles created by trigger (expect 4):
select count(*) from public.profiles where id::text like '11111111-1111-1111-1111-1111111111%';
\echo @@F all-members memberships created by trigger (expect 4):
select count(*) from public.group_members gm join public.groups g on g.id = gm.group_id
 where g.slug = 'all-members' and gm.user_id::text like '11111111-1111-1111-1111-1111111111%';

insert into public.user_roles select '11111111-1111-1111-1111-1111111111a1', id from public.roles where slug = 'admin';
insert into public.roles (id, slug, name) values ('22222222-2222-2222-2222-2222222222a1', 'usermgr', 'User manager'), ('22222222-2222-2222-2222-2222222222a2', 'mailer', 'Mailer');
insert into public.role_permissions values ('22222222-2222-2222-2222-2222222222a1', 'users.manage'), ('22222222-2222-2222-2222-2222222222a2', 'mail.send');
insert into public.user_roles values ('11111111-1111-1111-1111-1111111111b1', '22222222-2222-2222-2222-2222222222a1');
insert into public.groups (id, slug, name) values ('33333333-3333-3333-3333-3333333333a1', 'mailers', 'Mailers');
insert into public.group_roles values ('33333333-3333-3333-3333-3333333333a1', '22222222-2222-2222-2222-2222222222a2');

-- ---- T1 direct role
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-1111111111a1","role":"authenticated"}', true);
\echo @@T1 admin has roles.manage (expect t):
select public.has_permission('roles.manage');
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-1111111111c1","role":"authenticated"}', true);
\echo @@T1 plain member has roles.manage (expect f):
select public.has_permission('roles.manage');
reset role;

-- ---- T2 inheritance through a group, then removal
insert into public.group_members values ('33333333-3333-3333-3333-3333333333a1', '11111111-1111-1111-1111-1111111111c1');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-1111111111c1","role":"authenticated"}', true);
\echo @@T2 member via group has mail.send (expect t):
select public.has_permission('mail.send');
reset role;
delete from public.group_members where group_id = '33333333-3333-3333-3333-3333333333a1' and user_id = '11111111-1111-1111-1111-1111111111c1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-1111111111c1","role":"authenticated"}', true);
\echo @@T2 after removal from the group (expect f):
select public.has_permission('mail.send');
reset role;

-- ---- T3 suspension
insert into public.group_members values ('33333333-3333-3333-3333-3333333333a1', '11111111-1111-1111-1111-1111111111c1');
update public.profiles set status = 'suspended' where id = '11111111-1111-1111-1111-1111111111c1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-1111111111c1","role":"authenticated"}', true);
\echo @@T3 suspended member has mail.send (expect f):
select public.has_permission('mail.send');
reset role;
update public.profiles set status = 'active' where id = '11111111-1111-1111-1111-1111111111c1';
delete from public.group_members where group_id = '33333333-3333-3333-3333-3333333333a1' and user_id = '11111111-1111-1111-1111-1111111111c1';

-- ---- T4 escalation: B holds users.manage only
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-1111111111b1","role":"authenticated"}', true);
do $$ begin
  insert into public.user_roles select '11111111-1111-1111-1111-1111111111c1', id from public.roles where slug = 'admin';
  raise notice '@@T4a B grants ADMIN to C: FAIL (allowed)';
exception when others then raise notice '@@T4a B grants ADMIN to C: PASS blocked (% %)', sqlstate, sqlerrm; end $$;
do $$ begin
  insert into public.user_roles values ('11111111-1111-1111-1111-1111111111c1', '22222222-2222-2222-2222-2222222222a1');
  raise notice '@@T4b B grants usermgr (a role B fully holds) to C: PASS allowed';
exception when others then raise notice '@@T4b B grants usermgr to C: FAIL blocked (% %)', sqlstate, sqlerrm; end $$;
do $$ begin
  insert into public.group_members values ('33333333-3333-3333-3333-3333333333a1', '11111111-1111-1111-1111-1111111111d1');
  raise notice '@@T4c B adds D to a group whose role B cannot grant: FAIL (allowed)';
exception when others then raise notice '@@T4c B adds D to a group whose role B cannot grant: PASS blocked (% %)', sqlstate, sqlerrm; end $$;
reset role;

-- ---- T5 last admin guard
do $$ begin
  delete from public.user_roles where user_id = '11111111-1111-1111-1111-1111111111a1'
    and role_id = (select id from public.roles where slug = 'admin');
  raise notice '@@T5a removing the LAST admin: FAIL (allowed)';
exception when others then raise notice '@@T5a removing the LAST admin: PASS blocked (% %)', sqlstate, sqlerrm; end $$;
insert into public.user_roles select '11111111-1111-1111-1111-1111111111d1', id from public.roles where slug = 'admin';
do $$ begin
  delete from public.user_roles where user_id = '11111111-1111-1111-1111-1111111111a1'
    and role_id = (select id from public.roles where slug = 'admin');
  raise notice '@@T5b removing an admin when a second exists: PASS allowed';
exception when others then raise notice '@@T5b removing an admin when a second exists: FAIL blocked (% %)', sqlstate, sqlerrm; end $$;

-- ---- T6 anonymous access to tables (talent tables have no RLS in M9 as written)
insert into public.candidates (user_id, consent_at, cv_source) values ('11111111-1111-1111-1111-1111111111c1', now(), 'drive');
insert into public.skills (name) values ('Next.js');
set local role anon;
\echo @@T6a anon can READ candidates (0 = protected, >0 = exposed):
select count(*) from public.candidates;
\echo @@T6b anon can read skills (0 = protected):
select count(*) from public.skills;
do $$ declare n int; begin
  with d as (delete from public.candidates returning 1) select count(*) into n from d;
  raise notice '@@T6c anon DELETE on candidates removed % row(s) (0 = protected)', n;
exception when others then raise notice '@@T6c anon delete blocked (% %)', sqlstate, sqlerrm; end $$;
\echo @@T6d anon can read roles (0 = protected):
select count(*) from public.roles;
\echo @@T6e anon can read profiles (0 = protected):
select count(*) from public.profiles;
reset role;

-- ---- T7 function exposure to anon
set local role anon;
do $$ begin perform public.can_see_event(gen_random_uuid()); raise notice '@@T7a anon CAN execute can_see_event (convention says revoke)';
exception when others then raise notice '@@T7a anon cannot execute can_see_event (% )', sqlstate; end $$;
do $$ begin perform public.has_permission('mail.send'); raise notice '@@T7b anon CAN execute has_permission';
exception when others then raise notice '@@T7b anon cannot execute has_permission (%)', sqlstate; end $$;
reset role;

-- ---- T8 token hook
\echo @@T8 supabase_auth_admin can execute the hook (expect t):
select has_function_privilege('supabase_auth_admin', 'public.custom_access_token_hook(jsonb)', 'execute');
\echo @@T8 hook output for admin A (app_permissions count, expect 15):
select jsonb_array_length(public.custom_access_token_hook(jsonb_build_object('user_id','11111111-1111-1111-1111-1111111111a1','claims','{}'::jsonb)) -> 'claims' -> 'app_permissions');
