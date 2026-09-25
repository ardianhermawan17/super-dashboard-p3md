-- PSI-014 verification: last-admin guard + existing guards (M1)
\echo '=== 1. assert_admin_remains + triggers exist ==='
select tgname, tgrelid::regclass
from pg_trigger
where tgname like '%admin_guard%';

\echo '=== 2. users_with_permission sees admin ==='
select count(*) as admins_with_roles_manage
from public.users_with_permission('roles.manage');

-- last-admin guard probes (all rolled back)
begin;

\echo '=== 3. deleting admin user_roles row is blocked ==='
delete from public.user_roles
where user_id = '00000000-0000-0000-0000-000000000002';

rollback;

\echo '=== 4. suspending the admin (status -> suspended) is blocked ==='
begin;
update public.profiles set status = 'suspended'
where id = '00000000-0000-0000-0000-000000000002';
rollback;

\echo '=== 5. removing roles.manage from the admin role is blocked ==='
begin;
delete from public.role_permissions
where permission_key = 'roles.manage';
rollback;

\echo '=== 6. dropping admin from all-members group is blocked (group_members guard) ==='
begin;
delete from public.group_members
where user_id = '00000000-0000-0000-0000-000000000002';
rollback;

\echo '=== 7. suspension semantics: effective_role_ids empty for suspended (M1) ==='
begin;
update public.profiles set status = 'suspended'
where id = '00000000-0000-0000-0000-000000000001';
select 'suspended member1 effective roles' as check_name,
       (select count(*) from public.effective_role_ids('00000000-0000-0000-0000-000000000001')) as role_count;
rollback;
