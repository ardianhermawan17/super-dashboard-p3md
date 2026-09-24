\set VERBOSITY terse
\pset pager off
\pset null '-'

\echo @@A1 tables in public: rls_enabled / policy count / forced
select c.relname as tbl, c.relrowsecurity as rls, (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p') order by 1;

\echo @@A2 tables WITHOUT rls
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity order by 1;

\echo @@A3 rls enabled but no policy at all (deny-all for anon/authenticated)
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid) order by 1;

\echo @@A4 policies calling auth.uid()/has_permission()/my_*() WITHOUT the (select ...) wrapper
select c.relname as tbl, p.polname, p.polcmd,
  coalesce(pg_get_expr(p.polqual, p.polrelid),'') || ' || ' || coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'') as expr
from pg_policy p join pg_class c on c.oid = p.polrelid
where (coalesce(pg_get_expr(p.polqual, p.polrelid),'') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')) ~ '(auth\.uid\(\)|has_permission\(|my_role_ids\(|my_group_ids\()'
  and (coalesce(pg_get_expr(p.polqual, p.polrelid),'') || coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')) !~* 'SELECT (auth\.uid|public\.has_permission|has_permission|public\.my_)'
order by 1,2;

\echo @@A5 policies that are literally "true"
select c.relname as tbl, p.polname, p.polcmd, p.polroles::regrole[]::text as roles
from pg_policy p join pg_class c on c.oid = p.polrelid
where pg_get_expr(p.polqual, p.polrelid) = 'true' or pg_get_expr(p.polwithcheck, p.polrelid) = 'true' order by 1,2;

\echo @@A6 SECURITY DEFINER functions in public/private WITHOUT search_path set
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','private') and p.prosecdef
  and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%'))
order by 1,2;

\echo @@A7 function EXECUTE grants in public: anon / authenticated / service_role / PUBLIC   (t = can execute)
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fn,
  case when p.prosecdef then 'DEF' else 'inv' end as sec,
  has_function_privilege('anon', p.oid, 'execute') as anon,
  has_function_privilege('authenticated', p.oid, 'execute') as authd,
  has_function_privilege('service_role', p.oid, 'execute') as svc,
  coalesce((select bool_or(a.grantee = 0) from aclexplode(p.proacl) a where a.privilege_type='EXECUTE'), p.proacl is null) as public_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f' order by 1;

\echo @@A8 views: security_invoker?
select c.relname, coalesce(c.reloptions::text,'-') as options
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v' order by 1;

\echo @@A9 foreign keys without a supporting index
select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
from pg_constraint c
where contype = 'f' and connamespace = 'public'::regnamespace
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] @> c.conkey and array_length(c.conkey,1) >= 1
      and (i.indkey::int2[])[0:array_length(c.conkey,1)-1] <@ c.conkey)
order by 1,2;

\echo @@A10 cron jobs
select jobname, schedule, left(command, 90) as command from cron.job order by jobname;

\echo @@A11 realtime publication tables
select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1,2;

\echo @@A12 user triggers (non-internal) by table
select c.relname as tbl, t.tgname, pg_get_triggerdef(t.oid) as def
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname in ('public','auth') order by 1,2;

\echo @@A13 extensions installed
select extname from pg_extension order by 1;

\echo @@A14 permission keys defined
select key from public.permissions order by 1;

\echo @@A15 roles / groups seeded by the migration itself
select 'roles' as t, count(*) from public.roles union all select 'groups', count(*) from public.groups union all select 'role_permissions', count(*) from public.role_permissions;
