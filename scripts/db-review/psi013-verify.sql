-- PSI-013 verification
\echo '=== 1. functions exist ==='
select proname from pg_proc where proname in ('claims_for_user','custom_access_token_hook');

\echo '=== 2. admin user id ==='
select id, email from auth.users where email = 'admin@p3md.test';

\echo '=== 3. claims_for_user(admin) ==='
select public.claims_for_user((select id from auth.users where email = 'admin@p3md.test'));

\echo '=== 4. authenticated role has NO execute ==='
select p.proname,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authn_can_exec,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_exec,
       has_function_privilege('supabase_auth_admin', p.oid, 'EXECUTE') as auth_admin_can_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('claims_for_user','custom_access_token_hook')
order by p.proname;

\echo '=== 5. hook returns jsonb with merged claims ==='
select public.custom_access_token_hook(jsonb_build_object('user_id', (select id::text from auth.users where email = 'admin@p3md.test'), 'claims', jsonb_build_object('sub', (select id::text from auth.users where email = 'admin@p3md.test'))));