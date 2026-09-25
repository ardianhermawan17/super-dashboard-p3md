-- PSI-013 verification: roles inherited through groups (rolled back, no pollution)
begin;

-- fixed ids so the probe is deterministic
insert into public.roles (id, slug, name, description, is_system)
values ('11111111-1111-1111-1111-111111111111', 'test-sr', 'Test Site Reliability', 'PSI-013 probe role', false);

insert into public.role_permissions (role_id, permission_key)
values ('11111111-1111-1111-1111-111111111111', 'mail.send');

insert into public.groups (id, slug, name, description, is_system)
values ('22222222-2222-2222-2222-222222222222', 'test-oncall', 'Test Oncall', 'PSI-013 probe group', false);

-- give the role to the group (group -> role edge)
insert into public.group_roles (group_id, role_id)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');

-- member1 (no direct role) joins the group
insert into public.group_members (group_id, user_id)
values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001');

-- member1's claims should include test-sr inherited via the group
\echo '=== member1 claims with group-inherited role ==='
select public.claims_for_user('00000000-0000-0000-0000-000000000001');

rollback;