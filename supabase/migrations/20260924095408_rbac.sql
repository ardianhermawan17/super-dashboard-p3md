-- M1 RBAC core (PSI-012): users, groups, roles, permissions, RLS, resolution functions, system rows.
-- Source of truth: docs/database-architecture/m1-rbac.md, section "Migration M1" (copied verbatim).
-- Not in this file on purpose: access-token hook (PSI-013), last-admin triggers (PSI-014).

-- ============ catalogue & structure ============
create table public.permissions (
  key text primary key check (key ~ '^[a-z]+(\.[a-z_]+)+$'),
  module text not null,
  description text not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);

create table public.group_roles (
  group_id uuid not null references public.groups(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (group_id, role_id)
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (user_id, role_id)
);
create index on public.user_roles (role_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  timezone text not null default 'Asia/Jakarta',
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);

-- Pre-provisioned access, applied on first sign-in (see backend-architecture/auth-and-onboarding.md).
create table public.user_invites (
  email text primary key check (email = lower(email)),
  full_name text,
  group_ids uuid[] not null default '{}',
  role_ids uuid[] not null default '{}',
  invited_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_invites enable row level security;

-- ============ resolution functions ============
create or replace function public.effective_role_ids(p_user uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select ur.role_id from public.user_roles ur
   where ur.user_id = p_user
     and exists (select 1 from public.profiles p where p.id = p_user and p.status = 'active')
  union
  select gr.role_id from public.group_members gm
    join public.group_roles gr on gr.group_id = gm.group_id
   where gm.user_id = p_user
     and exists (select 1 from public.profiles p where p.id = p_user and p.status = 'active');
$$;

create or replace function public.my_role_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select public.effective_role_ids((select auth.uid()));
$$;

create or replace function public.my_group_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select gm.group_id from public.group_members gm
   where gm.user_id = (select auth.uid())
     and exists (select 1 from public.profiles p where p.id = gm.user_id and p.status = 'active');
$$;

create or replace function public.has_permission(p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.role_permissions rp
                  where rp.permission_key = p_key
                    and rp.role_id in (select public.my_role_ids()));
$$;

create or replace function public.in_group(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_group in (select public.my_group_ids());
$$;

-- Service-side: who holds a permission (digest receivers, audits).
create or replace function public.users_with_permission(p_key text)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p
   where p.status = 'active'
     and exists (select 1 from public.role_permissions rp
                  where rp.permission_key = p_key
                    and rp.role_id in (select public.effective_role_ids(p.id)));
$$;

revoke execute on function public.effective_role_ids(uuid), public.users_with_permission(text)
  from public, anon, authenticated;
grant execute on function public.effective_role_ids(uuid), public.users_with_permission(text) to service_role;
revoke execute on function public.my_role_ids(), public.my_group_ids(), public.has_permission(text),
  public.in_group(uuid) from public, anon;
grant execute on function public.my_role_ids(), public.my_group_ids(), public.has_permission(text),
  public.in_group(uuid) to authenticated, service_role;

-- ============ escalation guards (see "Guards" below) ============
create or replace function public.can_grant_role(p_role uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.role_permissions rp
     where rp.role_id = p_role
       and not exists (select 1 from public.role_permissions mine
                        where mine.permission_key = rp.permission_key
                          and mine.role_id in (select public.my_role_ids())));
$$;

create or replace function public.can_grant_group(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.group_roles gr
                      where gr.group_id = p_group and not public.can_grant_role(gr.role_id));
$$;

-- ============ policies ============
-- using (true) below: catalogue, role and group names are configuration, not personal data;
-- every signed-in user needs them for pickers (mail target, audience, board sharing).
create policy "permissions readable" on public.permissions for select to authenticated using (true);

create policy "roles readable" on public.roles for select to authenticated using (true);
create policy "roles created" on public.roles for insert to authenticated
  with check ((select public.has_permission('roles.manage')));
create policy "roles edited" on public.roles for update to authenticated
  using ((select public.has_permission('roles.manage'))) with check ((select public.has_permission('roles.manage')));
create policy "roles deleted" on public.roles for delete to authenticated
  using ((select public.has_permission('roles.manage')) and not is_system);

create policy "role permissions readable" on public.role_permissions for select to authenticated using (true);
create policy "role permissions granted" on public.role_permissions for insert to authenticated
  with check ((select public.has_permission('roles.manage')) and public.has_permission(permission_key));
create policy "role permissions revoked" on public.role_permissions for delete to authenticated
  using ((select public.has_permission('roles.manage')));

create policy "groups readable" on public.groups for select to authenticated using (true);
create policy "groups created" on public.groups for insert to authenticated
  with check ((select public.has_permission('groups.manage')));
create policy "groups edited" on public.groups for update to authenticated
  using ((select public.has_permission('groups.manage'))) with check ((select public.has_permission('groups.manage')));
create policy "groups deleted" on public.groups for delete to authenticated
  using ((select public.has_permission('groups.manage')) and not is_system);

create policy "group members readable" on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or public.in_group(group_id)
         or (select public.has_permission('users.read')) or (select public.has_permission('groups.manage')));
create policy "group members added" on public.group_members for insert to authenticated
  with check (((select public.has_permission('groups.manage')) or (select public.has_permission('users.manage')))
              and public.can_grant_group(group_id));
create policy "group members removed" on public.group_members for delete to authenticated
  using ((select public.has_permission('groups.manage')) or (select public.has_permission('users.manage')));

create policy "group roles readable" on public.group_roles for select to authenticated using (true);
create policy "group roles granted" on public.group_roles for insert to authenticated
  with check ((select public.has_permission('roles.manage')) and public.can_grant_role(role_id));
create policy "group roles revoked" on public.group_roles for delete to authenticated
  using ((select public.has_permission('roles.manage')));

create policy "user roles readable" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_permission('users.read'))
         or (select public.has_permission('users.manage')));
create policy "user roles granted" on public.user_roles for insert to authenticated
  with check ((select public.has_permission('users.manage')) and public.can_grant_role(role_id));
create policy "user roles revoked" on public.user_roles for delete to authenticated
  using ((select public.has_permission('users.manage')));

-- using (true): member directory (names, avatars) for assignees and invitees. Emails are NOT here.
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile editable" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Users may edit only these columns; status changes go through admin-users (service role).
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, timezone) on public.profiles to authenticated;

create policy "invites managed" on public.user_invites for all to authenticated
  using ((select public.has_permission('users.manage')))
  with check ((select public.has_permission('users.manage'))
              and not exists (select 1 from unnest(role_ids) r where not public.can_grant_role(r))
              and not exists (select 1 from unnest(group_ids) g where not public.can_grant_group(g)));

-- ============ new users ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_invite public.user_invites;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));

  insert into public.group_members (group_id, user_id)
  select id, new.id from public.groups where slug = 'all-members';

  select * into v_invite from public.user_invites
   where email = lower(new.email) and accepted_at is null;
  if found then
    insert into public.group_members (group_id, user_id)
      select g, new.id from unnest(v_invite.group_ids) g on conflict do nothing;
    insert into public.user_roles (user_id, role_id)
      select new.id, r from unnest(v_invite.role_ids) r on conflict do nothing;
    update public.user_invites set accepted_at = now() where email = v_invite.email;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ system rows ============
insert into public.permissions (key, module, description) values
  ('users.read', 'rbac', 'See the member directory with emails, status and last sign-in'),
  ('users.manage', 'rbac', 'Invite, suspend and reactivate users; assign their roles and groups'),
  ('roles.manage', 'rbac', 'Create, edit and delete roles; edit role permissions; give roles to groups'),
  ('groups.manage', 'rbac', 'Create, edit and delete groups; manage group members'),
  ('mail.send', 'mail', 'Send role or group mail'),
  ('mail.audit', 'mail', 'Read every role mail and its delivery status'),
  ('calendar.write', 'calendar', 'Create agenda events'),
  ('kanban.write', 'kanban', 'Create boards'),
  ('documents.manage', 'documents', 'Decide which Drive folders each role or group can see'),
  ('integrations.manage', 'integrations', 'Link Google calendars and Drive roots; trigger syncs'),
  ('talent.read', 'talent', 'See candidate scores and strong skills'),
  ('talent.manage', 'talent', 'Edit the skill taxonomy and the candidate pipeline'),
  ('agent.chat', 'agent', 'Use the in-app AI assistant'),
  ('agent.audit', 'agent', 'Read every agent tool call and digest'),
  ('digest.receive', 'agent', 'Receive the daily digest');

insert into public.roles (slug, name, description, is_system)
values ('admin', 'Administrator', 'Holds every permission', true);
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key from public.roles r cross join public.permissions p where r.slug = 'admin';

insert into public.groups (slug, name, description, is_system)
values ('all-members', 'All members', 'Every user, added automatically', true);
