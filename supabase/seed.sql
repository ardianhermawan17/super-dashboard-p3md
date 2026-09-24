-- Local development seed. Applied by `supabase db reset` (config.toml [db.seed]).
-- FAKE DATA ONLY: never real people, never real secrets (contract C-07, C-08).
-- All passwords below are the throwaway local value 'password123'.

-- ---------------------------------------------------------------- fake users
-- Fixed ids so pgTAP tests can refer to them (docs/database-architecture/testing-pgtap.md uses ...0001).
--   ...0001  member1  plain member, no special access
--   ...0002  admin    will hold the admin role once PSI-012 seeds roles
--   ...0003  member2  extra member (PSI-036 wants a role with 3 members)
--   ...0004  member3  extra member
-- GoTrue fails to log in if the token columns are NULL, so they are set to ''.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'member1@p3md.test', 'Member One'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'admin@p3md.test',   'Admin User'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'member2@p3md.test', 'Member Two'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'member3@p3md.test', 'Member Three')
) as u(id, email, full_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email like '%@p3md.test';

-- ---------------------------------------------------------------- roles, groups, memberships
-- Not seeded yet: those tables come with migration M1 (PSI-012), which depends on this task.
-- PSI-012 must add the seed rows here: an admin role for the user above, a few groups, and one
-- role with 3 members. Keep the ids fixed (...00a1 style) so tests can use them.

-- ---------------------------------------------------------------- local Vault secrets
-- Names come from docs/backend-architecture/push-notifications.md. Local values only.
-- From inside the database container the host is reachable as host.docker.internal.
select vault.create_secret('http://host.docker.internal:54371', 'project_url');
select vault.create_secret('http://host.docker.internal:3000',  'site_url');
select vault.create_secret('local-dev-only-internal-fn-secret', 'internal_fn_secret');
