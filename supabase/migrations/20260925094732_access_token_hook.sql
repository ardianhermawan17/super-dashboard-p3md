-- ============================================================
-- PSI-013 · Access-token hook with roles, groups and permissions
-- Adds app_roles, app_groups and app_permissions to every JWT for
-- the UI (menus, buttons). RLS never trusts these claims (m1-rbac.md rule 3).
-- ============================================================

create or replace function public.claims_for_user(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'app_roles', coalesce((select jsonb_agg(r.slug order by r.slug) from public.roles r
                            where r.id in (select public.effective_role_ids(p_user))), '[]'::jsonb),
    'app_groups', coalesce((select jsonb_agg(g.slug order by g.slug) from public.groups g
                             join public.group_members gm on gm.group_id = g.id
                            where gm.user_id = p_user), '[]'::jsonb),
    'app_permissions', coalesce((select jsonb_agg(distinct rp.permission_key order by rp.permission_key)
                                  from public.role_permissions rp
                                  where rp.role_id in (select public.effective_role_ids(p_user))), '[]'::jsonb)
  );
$$;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  return jsonb_set(event, '{claims}',
                   (event -> 'claims') || public.claims_for_user((event ->> 'user_id')::uuid));
end;
$$;

grant usage on schema public to supabase_auth_admin;
revoke execute on function public.claims_for_user(uuid) from public, anon, authenticated;
grant execute on function public.claims_for_user(uuid) to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
