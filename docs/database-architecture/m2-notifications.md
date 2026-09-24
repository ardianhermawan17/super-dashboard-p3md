# M2 · Notifications and push

> **Scope:** `notifications`, push subscriptions, preferences, `notify()`, the dispatch trigger, and the `internal_post()` helper every later migration uses.
> Pipeline: [push-notifications.md](../backend-architecture/push-notifications.md) · UI: [notifications-pwa.md](../frontend-architecture/features/notifications-pwa.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

M2 also installs `pg_net` / `pg_cron` and the `internal_post()` helper every later migration uses to call Edge Functions or Next.js routes.

```sql
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

-- One helper for all internal HTTP calls. Secrets come from Vault (set once per environment; see backend-architecture/push-notifications.md).
create or replace function public.internal_post(p_target text, p_path text, p_body jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_base text;
begin
  v_base := case p_target
    when 'functions' then (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/'
    when 'site' then (select decrypted_secret from vault.decrypted_secrets where name = 'site_url') || '/'
  end;
  if v_base is null then
    raise exception 'internal_post: unknown target % or missing Vault secret', p_target;
  end if;
  return net.http_post(
    url := v_base || p_path,
    body := p_body,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'internal_fn_secret')),
    timeout_milliseconds := 5000);
end $$;
revoke execute on function public.internal_post(text, text, jsonb) from public, anon, authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('mail.received', 'event.invited', 'event.updated',
                                     'task.assigned', 'digest.ready', 'document.added', 'system')),
  title text not null check (char_length(title) <= 120),
  body text check (char_length(body) <= 240),
  link text,                                   -- /dashboard/<feature>/<id>
  created_at timestamptz not null default now(),
  read_at timestamptz,
  pushed_at timestamptz
);
create index on public.notifications (user_id, created_at desc);
create index on public.notifications (user_id) where read_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create table public.notification_prefs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null,
  push boolean not null default true,
  primary key (user_id, type)
);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_prefs enable row level security;

create policy "own notifications readable" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own notifications markable" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;          -- mark read, nothing else
-- No insert policy: rows are created only by notify() (security definer).

create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own prefs" on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Create notifications (called by triggers and Edge Functions).
create or replace function public.notify(p_users uuid[], p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link)
  select distinct u, p_type, left(p_title, 120), left(p_body, 240), p_link
    from unnest(p_users) as u
   where u is not null;
$$;
revoke execute on function public.notify(uuid[], text, text, text, text) from public, anon, authenticated;
grant execute on function public.notify(uuid[], text, text, text, text) to service_role;

-- A device endpoint belongs to whoever registered it last (shared devices, re-logins).
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void language sql security definer set search_path = '' as $$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
$$;
revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- Everything the dispatcher needs in one call (arrays go in the POST body, not a long URL).
create or replace function public.push_targets(p_ids uuid[])
returns table (notification_id uuid, title text, body text, link text, subscription_id uuid,
               endpoint text, p256dh text, auth text)
language sql stable security definer set search_path = '' as $$
  select n.id, n.title, n.body, n.link, s.id, s.endpoint, s.p256dh, s.auth
    from public.notifications n
    join public.push_subscriptions s on s.user_id = n.user_id
   where n.id = any(p_ids)
     and not exists (select 1 from public.notification_prefs np
                      where np.user_id = n.user_id and np.type = n.type and np.push = false);
$$;
revoke execute on function public.push_targets(uuid[]) from public, anon, authenticated;
grant execute on function public.push_targets(uuid[]) to service_role;

create or replace function public.mark_pushed(p_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.notifications set pushed_at = now() where id = any(p_ids);
$$;
revoke execute on function public.mark_pushed(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_pushed(uuid[]) to service_role;

-- One dispatch call per INSERT statement (400 recipients = 1 HTTP call, not 400).
create or replace function public.dispatch_push()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.internal_post('site', 'api/push/dispatch',
    jsonb_build_object('ids', (select jsonb_agg(id) from new_rows)));
  return null;
end $$;
create trigger notifications_dispatch after insert on public.notifications
  referencing new table as new_rows for each statement execute function public.dispatch_push();

alter publication supabase_realtime add table public.notifications;

-- Keep the table small: read notifications older than 90 days go away.
select cron.schedule('notifications-retention', '45 20 * * *',
  $$ delete from public.notifications where read_at is not null and created_at < now() - interval '90 days' $$);
```
