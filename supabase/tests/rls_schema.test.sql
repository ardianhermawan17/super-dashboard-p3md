-- ============================================================
-- supabase/tests/rls_schema.test.sql — schema-wide RLS (PSI-015)
-- Every table in public has RLS enabled; anon can read and write
-- none of them.
-- ============================================================

begin;
select plan(7);

-- 1. Every public table has RLS enabled.
select is(
  (select count(*)::int from pg_tables t
    join pg_class c on c.relname = t.tablename and c.relnamespace = 'public'::regnamespace
   where t.schemaname = 'public' and not c.relrowsecurity),
  0, 'every public table has RLS enabled');

-- 2. anon can read and write none of them.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  (select count(*)::int from public.permissions),
  0, 'anon cannot read permissions');
select is(
  (select count(*)::int from public.roles),
  0, 'anon cannot read roles');
select is(
  (select count(*)::int from public.profiles),
  0, 'anon cannot read profiles');
select is(
  (select count(*)::int from public.groups),
  0, 'anon cannot read groups');

select throws_ok(
  $$ insert into public.profiles (id, full_name) values ('00000000-0000-0000-0000-000000000099', 'anon') $$,
  '42501', null, 'anon cannot insert into profiles');

select throws_ok(
  $$ insert into public.groups (slug, name, description, is_system) values ('anon-group', 'Anon', 'anon', false) $$,
  '42501', null, 'anon cannot insert into groups');

select * from finish();
rollback;