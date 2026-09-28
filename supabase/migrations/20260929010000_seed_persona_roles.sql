-- Seed persona roles for Human Review / Multi-role testing
-- 1. Project Manager (all operational modules: boards, calendar, finance, docs, talent, mail, ai)
-- 2. Accountant / Finance (finance ledger, entries, reports, finance AI assistant, digest)
-- 3. Operation (calendar agenda, kanban tasks, member directory, operations AI assistant, digest)

insert into public.roles (slug, name, description, is_system) values
  ('project-manager', 'Project Manager', 'Full operational access across boards, calendar, finance, and talent', false),
  ('accountant',      'Accountant',      'Dedicated access to finance transactions, ledger, and reporting', false),
  ('operation',       'Operation',       'Operational access focused on tasks, Kanban boards, and calendar scheduling', false)
on conflict (slug) do nothing;

-- Permissions for Project Manager
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.slug = 'project-manager'
  and p.key in (
    'kanban.write',
    'calendar.write',
    'finance.read',
    'finance.write',
    'documents.manage',
    'mail.send',
    'mail.audit',
    'talent.read',
    'talent.manage',
    'agent.chat',
    'agent.audit',
    'digest.receive',
    'users.read'
  )
on conflict do nothing;

-- Permissions for Accountant (Finance + Digest + AI)
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.slug = 'accountant'
  and p.key in (
    'finance.read',
    'finance.write',
    'agent.chat',
    'digest.receive'
  )
on conflict do nothing;

-- Permissions for Operation (Calendar + Tasks + Digest + AI + Directory)
insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where r.slug = 'operation'
  and p.key in (
    'kanban.write',
    'calendar.write',
    'agent.chat',
    'digest.receive',
    'users.read'
  )
on conflict do nothing;
