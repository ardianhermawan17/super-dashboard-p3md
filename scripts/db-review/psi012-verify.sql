\set VERBOSITY terse
\pset pager off
\pset tuples_only on
\pset format unaligned

\echo @@1 tables with RLS on (expect 9 of 9):
select count(*) filter (where c.relrowsecurity) || ' of ' || count(*)
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('permissions','roles','role_permissions','groups','group_members','group_roles','user_roles','profiles','user_invites');
\echo @@2 public tables total (expect 9):
select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';
\echo @@3 permissions / admin role perms / roles / groups (expect 15 / 15 / 1 / 1):
select (select count(*) from public.permissions) || ' / ' || (select count(*) from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.slug = 'admin') || ' / ' || (select count(*) from public.roles) || ' / ' || (select count(*) from public.groups);
\echo @@4 system rows flagged is_system (expect admin, all-members):
select string_agg(slug, ', ' order by slug) from (select slug from public.roles where is_system union all select slug from public.groups where is_system) s;
\echo @@5 seeded users: profiles / in all-members / with admin role (expect 4 / 4 / 1):
select (select count(*) from public.profiles) || ' / ' || (select count(*) from public.group_members gm join public.groups g on g.id = gm.group_id where g.slug = 'all-members') || ' / ' || (select count(*) from public.user_roles ur join public.roles r on r.id = ur.role_id where r.slug = 'admin' and ur.user_id = '00000000-0000-0000-0000-000000000002');
\echo @@6 resolution + guard functions present (expect 8):
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('effective_role_ids','my_role_ids','my_group_ids','has_permission','in_group','users_with_permission','can_grant_role','can_grant_group');
\echo @@7 definer functions without search_path (expect 0):
select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%');
\echo @@8 policies (expect 24) and policies missing the (select ...) wrapper (expect 0):
select (select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public')
  || ' / ' || (select count(*) from pg_policy p where (coalesce(pg_get_expr(p.polqual, p.polrelid),'') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')) ~ '(auth\.uid\(\)|has_permission\(|my_role_ids\(|my_group_ids\()' and (coalesce(pg_get_expr(p.polqual, p.polrelid),'') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')) !~* 'SELECT (auth\.uid|public\.has_permission|has_permission|public\.my_)');
\echo @@9 who can execute (anon, authenticated, service_role):
select p.proname || ': ' || has_function_privilege('anon', p.oid, 'execute') || ' ' || has_function_privilege('authenticated', p.oid, 'execute') || ' ' || has_function_privilege('service_role', p.oid, 'execute')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('effective_role_ids','users_with_permission','my_role_ids','has_permission','can_grant_role','handle_new_user') order by 1;

begin;
-- behaviour on the REAL seeded data, rolled back at the end
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
\echo @@10 seeded admin has roles.manage / mail.send (expect t / t):
select public.has_permission('roles.manage') || ' / ' || public.has_permission('mail.send');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
\echo @@10 seeded member1 has roles.manage (expect f):
select public.has_permission('roles.manage');
\echo @@11 member1 can read roles / groups / permissions / profiles / other users' role rows (expect 1 / 1 / 15 / 4 / 0):
select (select count(*) from public.roles) || ' / ' || (select count(*) from public.groups) || ' / ' || (select count(*) from public.permissions) || ' / ' || (select count(*) from public.profiles) || ' / ' || (select count(*) from public.user_roles);
do $$ begin
  update public.profiles set status = 'suspended' where id = '00000000-0000-0000-0000-000000000001';
  raise notice '@@12a member1 changes own status: FAIL allowed';
exception when others then raise notice '@@12a member1 changes own status: PASS blocked (%)', sqlstate; end $$;
do $$ declare n int; begin
  update public.profiles set full_name = 'Renamed' where id = '00000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count; raise notice '@@12b member1 renames self: % row(s) (expect 1)', n;
exception when others then raise notice '@@12b member1 renames self: FAIL (%)', sqlstate; end $$;
do $$ declare n int; begin
  update public.profiles set full_name = 'Hacked' where id = '00000000-0000-0000-0000-000000000003';
  get diagnostics n = row_count; raise notice '@@12c member1 renames someone else: % row(s) (expect 0)', n;
end $$;
do $$ begin
  insert into public.user_roles select '00000000-0000-0000-0000-000000000001', id from public.roles where slug = 'admin';
  raise notice '@@13 member1 grants itself admin: FAIL allowed';
exception when others then raise notice '@@13 member1 grants itself admin: PASS blocked (%)', sqlstate; end $$;
do $$ begin
  delete from public.roles where slug = 'admin';
  raise notice '@@14 member1 deletes admin role: no error raised, see next line for rows';
exception when others then raise notice '@@14 member1 deletes admin role: blocked (%)', sqlstate; end $$;
reset role;
\echo @@14 admin role still there (expect 1):
select count(*) from public.roles where slug = 'admin';

-- as the admin: delete of a system role must fail (is_system), custom role delete works
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
do $$ declare n int; begin
  delete from public.roles where slug = 'admin';
  get diagnostics n = row_count; raise notice '@@15 admin deletes the system admin role: % row(s) (expect 0)', n;
end $$;
do $$ declare n int; begin
  insert into public.roles (slug, name) values ('temp-role', 'Temp');
  delete from public.roles where slug = 'temp-role';
  get diagnostics n = row_count; raise notice '@@16 admin creates then deletes a custom role: % row(s) deleted (expect 1)', n;
exception when others then raise notice '@@16 admin creates a custom role: FAIL (% %)', sqlstate, sqlerrm; end $$;
reset role;

-- anonymous access
set local role anon;
\echo @@17 anon reads roles / profiles / user_roles (expect 0 / 0 / 0):
select (select count(*) from public.roles) || ' / ' || (select count(*) from public.profiles) || ' / ' || (select count(*) from public.user_roles);
reset role;
rollback;
