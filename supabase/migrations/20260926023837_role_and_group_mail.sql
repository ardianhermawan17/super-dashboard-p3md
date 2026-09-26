-- Migration M3 · Role and group mail
-- Scope: messages, message_recipients, is_message_sender, is_message_recipient, mail_recipients, mail_recipient_count

do $$
begin
  if not exists (select 1 from pg_type where typname = 'mail_status') then
    create type public.mail_status as enum ('draft', 'queued', 'sending', 'sent', 'failed');
  end if;
end $$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references auth.users(id) default auth.uid(),
  is_system boolean not null default false,             -- messages sent by jobs
  to_role_id uuid references public.roles(id),
  to_group_id uuid references public.groups(id),
  subject text not null check (char_length(subject) between 1 and 200),
  body_md text not null default '',
  status public.mail_status not null default 'draft',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check (num_nonnulls(to_role_id, to_group_id) = 1),
  check (is_system or sender_id is not null)
);
create index if not exists idx_messages_to_role on public.messages (to_role_id, created_at desc);
create index if not exists idx_messages_to_group on public.messages (to_group_id, created_at desc);

-- No email column on purpose: addresses are resolved at send time and never stored here.
create table if not exists public.message_recipients (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'delivered', 'bounced', 'complained', 'failed')),
  provider_message_id text,
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists idx_message_recipients_provider on public.message_recipients (provider_message_id);
create index if not exists idx_message_recipients_user on public.message_recipients (user_id);

alter table public.messages enable row level security;
alter table public.message_recipients enable row level security;

-- SECURITY DEFINER helpers break the policy cycle (messages ↔ message_recipients).
create or replace function public.is_message_sender(p_message uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.messages where id = p_message and sender_id = (select auth.uid()));
$$;
revoke execute on function public.is_message_sender(uuid) from public, anon;
grant execute on function public.is_message_sender(uuid) to authenticated;

create or replace function public.is_message_recipient(p_message uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.message_recipients where message_id = p_message and user_id = (select auth.uid()));
$$;
revoke execute on function public.is_message_recipient(uuid) from public, anon;
grant execute on function public.is_message_recipient(uuid) to authenticated;

create policy "messages visible to sender, recipients, auditors" on public.messages for select to authenticated
  using (sender_id = (select auth.uid()) or public.is_message_recipient(id)
         or (select public.has_permission('mail.audit')));

create policy "messages created by senders" on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and not is_system
              and status in ('draft', 'queued') and (select public.has_permission('mail.send')));

create policy "own drafts editable" on public.messages for update to authenticated
  using (sender_id = (select auth.uid()) and status = 'draft')
  with check (sender_id = (select auth.uid()) and status in ('draft', 'queued'));

create policy "recipient rows visible" on public.message_recipients for select to authenticated
  using (user_id = (select auth.uid()) or public.is_message_sender(message_id)
         or (select public.has_permission('mail.audit')));

-- Target → people. The one place emails leave the database. Service role only.
create or replace function public.mail_recipients(p_role_id uuid, p_group_id uuid)
returns table (user_id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email::text
    from auth.users u
    join public.profiles p on p.id = u.id and p.status = 'active'
   where u.email is not null
     and u.deleted_at is null
     and ((p_role_id is not null and p_role_id in (select public.effective_role_ids(u.id)))
       or (p_group_id is not null and exists (select 1 from public.group_members gm
                                               where gm.group_id = p_group_id and gm.user_id = u.id)));
$$;
revoke execute on function public.mail_recipients(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mail_recipients(uuid, uuid) to service_role;

-- Count only, safe for the compose UI.
create or replace function public.mail_recipient_count(p_role_id uuid, p_group_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::int
    from public.profiles p
   where p.status = 'active'
     and ((p_role_id is not null and p_role_id in (select public.effective_role_ids(p.id)))
       or (p_group_id is not null and exists (select 1 from public.group_members gm
                                               where gm.group_id = p_group_id and gm.user_id = p.id)));
$$;
revoke execute on function public.mail_recipient_count(uuid, uuid) from public, anon;
grant execute on function public.mail_recipient_count(uuid, uuid) to authenticated;
