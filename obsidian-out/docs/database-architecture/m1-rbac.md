# M1 · RBAC: users, groups, roles, permissions

> **Scope:** the access model and its migration: tables, resolution functions, policies, the access-token hook, escalation guards, admin helpers, auth hooks.
> UI: [admin.md](../frontend-architecture/features/admin.md) · onboarding: [auth-and-onboarding.md](../backend-architecture/auth-and-onboarding.md) · tests: [testing-pgtap.md](testing-pgtap.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## The model

```
auth.users ─1:1─ profiles (status: active | suspended)
    │
    ├──── user_roles ─────────────────────────┐
    │                                         ▼
    └──── group_members ── groups ── group_roles ── roles ── role_permissions ── permissions
                                                   (job positions)              (capability keys)

effective roles(user)       = direct roles ∪ roles of every group the user is in   (suspended → none)
effective permissions(user) = permissions of the effective roles
```

| Entity | Example | Who manages it |
|---|---|---|
| User | Ficana | `users.manage` (invite, suspend, assign) |
| Group | `it-team`, `pflp-batch-7`, `all-members` | `groups.manage` (members), `roles.manage` (group's roles) |
| Role | `projectmanager`, `site-reliability`, `admin` | `roles.manage` |
| Permission | `mail.send` | Migrations only; granted to roles by `roles.manage` |

Why groups **and** roles: roles answer "what is this person's job" (and are mail targets), groups answer "which cohort or team are they in" (and are also mail, calendar and board audiences). Giving a role to a group turns "everyone in batch 7 is a `participant`" into one row instead of 400.

## Rules

1. **Permissions are the only thing code checks** (contract C-17). Roles and groups exist to hand out permissions and to address people; they never appear in an `if`.
2. **Permission keys are created by migrations**, never in the UI, because code references them. The migration that adds a key also grants it to `admin`.
3. **Membership is read from tables, not from the JWT.** RLS uses `my_role_ids()` / `my_group_ids()` / `has_permission()`, which read tables, so removing someone's access takes effect on their next request. The JWT claims are a hint for the UI only.
4. **No escalation.** You can only grant a role (to a user or a group) whose permissions you hold yourself, and only add a permission to a role if you hold it.
5. **Someone always keeps `roles.manage`.** Removing the last active holder fails.
6. **Suspended users have no effective roles**, even before their current token expires.
7. **Everyone is in `all-members`** (system group), so "everyone" is just another audience.

## Permission catalogue

| Key | Module | Grants | Suggested roles |
|---|---|---|---|
| `users.read` | rbac | Member directory with emails, status, last sign-in | admin, projectmanager |
| `users.manage` | rbac | Invite, suspend, reactivate; assign roles and groups to users | admin |
| `roles.manage` | rbac | Create/edit/delete roles, edit role permissions, give roles to groups | admin |
| `groups.manage` | rbac | Create/edit/delete groups, manage members | admin, projectmanager |
| `mail.send` | mail | Send role or group mail | admin, projectmanager |
| `mail.audit` | mail | Read every role mail and its delivery status | admin |
| `calendar.write` | calendar | Create agenda events | admin, projectmanager |
| `kanban.write` | kanban | Create boards | admin, projectmanager |
| `documents.manage` | documents | Decide which Drive folders each role/group sees | admin |
| `integrations.manage` | integrations | Link Google calendars and Drive roots, trigger syncs | admin |
| `talent.read` | talent | Candidate scores and strong skills | admin, projectmanager |
| `talent.manage` | talent | Skill taxonomy and candidate pipeline | admin |
| `agent.chat` | agent | In-app AI assistant | everyone who needs it |
| `agent.audit` | agent | Every agent tool call and digest | admin |
| `digest.receive` | agent | Daily digest | projectmanager |

Reading your own inbox, agenda, boards, documents and notifications needs no permission: visibility follows membership and audience.

## Migration M1

```sql
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
```

**First admin in production** (run once in the SQL editor after the owner signs up):

```sql
insert into public.user_roles (user_id, role_id)
select u.id, r.id from auth.users u, public.roles r
 where u.email = 'owner@your-domain.id' and r.slug = 'admin';
```

## Access-token hook

The hook adds `app_roles`, `app_groups` and `app_permissions` to every JWT **for the UI** (menus, buttons). RLS never trusts these claims (rule 3).

```sql
create or replace function public.claims_for_user(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'app_roles', coalesce((select jsonb_agg(r.slug order by r.slug) from public.roles r
                            where r.id in (select public.effective_role_ids(p_user))), '[]'::jsonb),
    'app_groups', coalesce((select jsonb_agg(g.slug order by g.slug) from public.groups g
                             join public.group_members gm on gm.group_id = g.id
                            where gm.user_id = p_user), '[]'::jsonb),
    'app_permissions', coalesce((select jsonb_agg(distinct rp.permission_key) from public.role_permissions rp
                                  where rp.role_id in (select public.effective_role_ids(p_user))), '[]'::jsonb)
  );
$$;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
begin
  return jsonb_set(event, '{claims}',
                   (event -> 'claims') || public.claims_for_user((event ->> 'user_id')::uuid));
end $$;

grant usage on schema public to supabase_auth_admin;
revoke execute on function public.claims_for_user(uuid) from public, anon, authenticated;
grant execute on function public.claims_for_user(uuid) to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
```

```toml
# supabase/config.toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

In production enable it under Dashboard → Authentication → Hooks.

## Guards

| Guard | How | Tested by |
|---|---|---|
| No escalation | `can_grant_role()` / `can_grant_group()` in insert policies; `has_permission(permission_key)` on `role_permissions` inserts; invite arrays checked the same way | [testing-pgtap.md](testing-pgtap.md) |
| Last admin | Statement trigger below on every table that can remove `roles.manage` | [testing-pgtap.md](testing-pgtap.md) |
| Suspension | `effective_role_ids` and `my_group_ids` return nothing for suspended users; the Auth ban stops new sign-ins | [testing-pgtap.md](testing-pgtap.md) |
| Self-reactivation | Column grants: users can update only `full_name`, `avatar_url`, `timezone` | [testing-pgtap.md](testing-pgtap.md) |
| System rows | `admin` and `all-members` cannot be deleted (`is_system`) | [testing-pgtap.md](testing-pgtap.md) |

```sql
create or replace function public.assert_admin_remains()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.users_with_permission('roles.manage')) then
    raise exception 'At least one active user must keep roles.manage';
  end if;
  return null;
end $$;

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
```

## Using it in policies

Wrap permission checks in `(select …)` so Postgres evaluates them once per statement instead of once per row:

```sql
create policy "messages created by senders" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (select public.has_permission('mail.send')));

-- audience visibility: direct user, a role I hold (directly or via a group), or a group I am in
... a.user_id = (select auth.uid())
    or a.role_id in (select public.my_role_ids())
    or a.group_id in (select public.my_group_ids())
```

In app code the same checks go through `requirePermission()` ([supabase-clients-and-session.md](../frontend-architecture/supabase-clients-and-session.md#guarding-pages-and-actions)).

## Admin helpers

The users table needs emails and last sign-in from `auth.users`, which PostgREST cannot read. Expose them through one gated function:

```sql
create or replace function public.admin_list_users()
returns table (id uuid, email text, full_name text, status text, last_sign_in_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text, p.full_name, p.status, u.last_sign_in_at, u.created_at
    from auth.users u join public.profiles p on p.id = u.id
   where (select public.has_permission('users.read')) or (select public.has_permission('users.manage'))
   order by p.full_name nulls last;
$$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;
```

## Auth hooks

Only needed with Google sign-in onboarding (option B in [auth-and-onboarding.md](../backend-architecture/auth-and-onboarding.md)): reject sign-ups whose email is not in `user_invites`.

```sql
create or replace function public.before_user_created_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if exists (select 1 from public.user_invites
              where email = lower(event -> 'user' ->> 'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403, 'message', 'This email is not invited to P3MD.'));
end $$;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.before_user_created_hook(jsonb) from public, anon, authenticated;
```

Verify the hook's payload shape against Supabase's Auth Hooks docs when implementing (PSI-016). The admin imports the CSV once; people sign in with Google whenever they like.
