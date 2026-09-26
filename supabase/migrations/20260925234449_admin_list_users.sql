-- Admin helper for listing users with email and auth metadata
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
