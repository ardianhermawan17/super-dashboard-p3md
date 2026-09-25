-- ============================================================
-- supabase/tests/rbac.test.sql — RBAC assertions (PSI-015)
-- Pattern: docs/database-architecture/testing-pgtap.md
-- Run: supabase test db
-- ============================================================

begin;
select plan(18);

-- Fixture rows are installed as postgres; assertions below switch roles.
set local role postgres;
insert into public.roles (id, slug, name, description, is_system)
values ('11111111-1111-1111-1111-111111111111', 'group-role-1', 'Group Role 1', 'PSI-015', false);
insert into public.groups (id, slug, name, description, is_system)
values ('22222222-2222-2222-2222-222222222222', 'group-a', 'Group A', 'PSI-015', false);
insert into public.group_roles (group_id, role_id)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
-- give group-role-1 a permission member3 lacks, so can_grant_role/group is false
insert into public.role_permissions (role_id, permission_key)
values ('11111111-1111-1111-1111-111111111111', 'mail.send');
insert into public.roles (id, slug, name, description, is_system)
values ('33333333-3333-3333-3333-333333333333', 'user-manager', 'User Manager', 'PSI-015', false);
insert into public.role_permissions (role_id, permission_key)
values ('33333333-3333-3333-3333-333333333333', 'users.manage');
insert into public.user_roles (user_id, role_id)
values ('00000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- 1. A user inherits a role through a group, and loses it when removed.
-- effective_role_ids is NOT executable by authenticated (M1 revokes it),
-- so verify the data model as postgres, which bypasses RLS.
set local role postgres;
insert into public.group_members (group_id, user_id)
values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001');
select is(
 (select '11111111-1111-1111-1111-111111111111' in (select public.effective_role_ids('00000000-0000-0000-0000-000000000001'))),
 true, 'member1 inherits group-role-1 through group-a');

delete from public.group_members
where group_id = '22222222-2222-2222-2222-222222222222' and user_id = '00000000-0000-0000-0000-000000000001';
select is(
 (select '11111111-1111-1111-1111-111111111111' in (select public.effective_role_ids('00000000-0000-0000-0000-000000000001'))),
 false, 'member1 loses group-role-1 after leaving group-a');

-- 2. A suspended user has no effective roles and has_permission is false.
set local role postgres;
update public.profiles set status = 'suspended'
where id = '00000000-0000-0000-0000-000000000001';
delete from public.user_roles where user_id = '00000000-0000-0000-0000-000000000001';
select is(
 (select count(*) = 0 from public.effective_role_ids('00000000-0000-0000-0000-000000000001')),
 true, 'suspended user has no effective roles');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
 (select public.has_permission('mail.send')),
 false, 'suspended user has_permission is false');

-- 3. A users.manage holder without roles.manage cannot grant admin.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ insert into public.user_roles (user_id, role_id)
     values ('00000000-0000-0000-0000-000000000004',
             (select id from public.roles where slug = 'admin')) $$,
  '42501', null, 'users.manage without roles.manage cannot grant admin (RLS)');

-- 4. Adding someone to a group whose roles you cannot grant fails.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ insert into public.group_members (group_id, user_id)
     values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000004') $$,
  '42501', null, 'without groups.manage adding a group member fails');

-- 5. Removing the last roles.manage holder fails; second-to-last succeeds.
-- (admin grants member3 the admin role as postgres fixture)
set local role postgres;
insert into public.user_roles (user_id, role_id)
values ('00000000-0000-0000-0000-000000000004', (select id from public.roles where slug = 'admin'));
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok(
 $$ delete from public.user_roles where user_id = '00000000-0000-0000-0000-000000000004' $$,
 'removing a second-to-last roles.manage holder succeeds');
select throws_ok(
  $$ delete from public.user_roles where user_id = '00000000-0000-0000-0000-000000000002' $$,
  'P0001', 'At least one active user must keep roles.manage',
  'removing the last roles.manage holder fails');

-- 6. admin and all-members cannot be deleted.
-- RLS using-clause filters the row out: no exception, but 0 rows deleted.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
 (select count(*)::int from public.roles where slug = 'admin'),
 1, 'admin role still exists before delete attempt');
delete from public.roles where slug = 'admin';
select is(
 (select count(*)::int from public.roles where slug = 'admin'),
 1, 'admin role cannot be deleted (RLS removes row from using-clause)');

select is(
 (select count(*)::int from public.groups where slug = 'all-members'),
 1, 'all-members group still exists before delete attempt');
delete from public.groups where slug = 'all-members';
select is(
 (select count(*)::int from public.groups where slug = 'all-members'),
 1, 'all-members group cannot be deleted (RLS removes row from using-clause)');

-- 7. A user cannot update their own status.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ update public.profiles set status = 'suspended'
     where id = '00000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'user cannot update own status (column grant excludes status)');

-- 8. effective_role_ids, users_with_permission, claims_for_user are
--    not executable by authenticated.
select throws_ok(
  $$ select * from public.effective_role_ids('00000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'effective_role_ids not executable by authenticated');
select throws_ok(
  $$ select * from public.users_with_permission('roles.manage') $$,
  '42501', null, 'users_with_permission not executable by authenticated');
select throws_ok(
  $$ select public.claims_for_user('00000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'claims_for_user not executable by authenticated');

-- 9. A new user lands in all-members; an invited user gets invite groups/roles.
-- Simulate the auth trigger: insert a raw auth user then invoke on_auth_user_created.
set local role postgres;
insert into public.user_invites (email, full_name, group_ids, role_ids)
values ('invitee@p3md.test', 'Invitee',
 array['22222222-2222-2222-2222-222222222222'::uuid],
 array['11111111-1111-1111-1111-111111111111'::uuid]);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'invitee@p3md.test', '', now(), '{}', '{"full_name":"Invitee"}', now(), now())
on conflict (id) do nothing;

select is(
  (select count(*) = 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
   where gm.user_id = '44444444-4444-4444-4444-444444444444' and g.slug = 'all-members'),
  true, 'new user lands in all-members');

select is(
  (select count(*) = 1 from public.user_roles
   where user_id = '44444444-4444-4444-4444-444444444444'
     and role_id = '11111111-1111-1111-1111-111111111111'),
  true, 'invited user gets the invite role');

select * from finish();
rollback;