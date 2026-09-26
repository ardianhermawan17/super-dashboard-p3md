-- ============================================================
-- PSI-014 · RBAC guards: no escalation, last admin, suspension
-- M1 already ships: can_grant_role/can_grant_group in insert
-- policies, suspension (effective_role_ids filters status='active'),
-- and limited profile column grants. This migration adds the
-- missing last-admin guard: after any change that could remove
-- roles.manage, the DB refuses if nobody could still grant it.
-- ============================================================

create or replace function public.assert_admin_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.users_with_permission('roles.manage')) then
    raise exception 'At least one active user must keep roles.manage';
  end if;
  return null;
end;
$$;

-- statement triggers on every path that can remove roles.manage
create trigger user_roles_admin_guard after delete on public.user_roles
for each statement execute function public.assert_admin_remains();

create trigger group_members_admin_guard after delete on public.group_members
for each statement execute function public.assert_admin_remains();

create trigger group_roles_admin_guard after delete on public.group_roles
for each statement execute function public.assert_admin_remains();

create trigger role_permissions_admin_guard after delete on public.role_permissions
for each statement execute function public.assert_admin_remains();

create trigger profiles_admin_guard after update of status on public.profiles
for each statement execute function public.assert_admin_remains();
