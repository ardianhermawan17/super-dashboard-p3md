# Testing RLS and RBAC with pgTAP

> **Scope:** the test pattern every migration follows and the RBAC assertions that must pass.
> Migrations: [README](README.md) · Index: [database-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

Every migration that adds a policy ships a test in `supabase/tests/`. Pattern:

```sql
-- supabase/tests/role_mail.test.sql
begin;
select plan(3);

-- Seeded fake user without mail.send; RLS reads tables, so only `sub` matters in the claims.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(public.has_permission('mail.send'), false, 'plain member cannot send mail');
select throws_ok(
  $$ insert into public.messages (to_role_id, subject, status)
     values ('00000000-0000-0000-0000-0000000000a1', 'hi', 'queued') $$,
  '42501', null, 'insert without mail.send is rejected by RLS');
select throws_ok(
  $$ select * from public.mail_recipients('00000000-0000-0000-0000-0000000000a1', null) $$,
  '42501', null, 'mail_recipients is not executable by authenticated');

select * from finish();
rollback;
```

Minimum per feature: one "member can", one "non-member cannot", one "function not callable by `authenticated`". RBAC has its own list (below).

## RBAC assertions (`supabase/tests/rbac.test.sql`)

`supabase/tests/rbac.test.sql` must prove at least:

- [ ] A user inherits a role through a group, and loses it when removed from the group.
- [ ] A suspended user has no effective roles and `has_permission` is false for every key.
- [ ] A `users.manage` holder without `roles.manage` cannot grant the `admin` role (escalation).
- [ ] Adding someone to a group whose roles you cannot grant fails.
- [ ] Removing the last `roles.manage` holder fails; removing a second-to-last succeeds.
- [ ] `admin` and `all-members` cannot be deleted.
- [ ] A user cannot update their own `status`.
- [ ] `effective_role_ids`, `users_with_permission`, `claims_for_user` are not executable by `authenticated`.
- [ ] A new user lands in `all-members`, and an invited user gets the invite's groups and roles.
