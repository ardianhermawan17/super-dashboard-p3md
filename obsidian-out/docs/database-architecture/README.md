# Database architecture

> **Scope:** everything that runs **inside Postgres**: schema, RLS policies, SQL functions, triggers, views, pg_cron schedules, migrations and their pgTAP tests.
> Code that calls external services lives in [backend-architecture/](../backend-architecture/README.md); UI in [frontend-architecture/](../frontend-architecture/README.md). Placement rule: [system-overview.md](../system-overview.md). Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Why this is its own folder, not part of the backend

With Supabase, Postgres **is** most of the backend. Authorization (RLS), recipient resolution, audience visibility, notifications, activity logging and scheduling are all SQL. Keeping them in `backend-architecture/` would bury the most security-critical layer under Deno and Next.js code that changes for different reasons.

| | `database-architecture/` | `backend-architecture/` |
|---|---|---|
| Language | SQL | TypeScript (Deno, Node) |
| Change unit | Immutable migration file (C-06) | Normal code edit |
| Review gate | Human approval for RLS, roles, permissions, destructive SQL (C-15) | Normal PR review |
| Proof | pgTAP (`supabase test db`) | tsc, lint, build, function tests |
| ECC reviewer | `database-reviewer` agent | `typescript-reviewer` / `code-reviewer` |

So: **three layer folders** (frontend, backend, database). A feature usually touches all three; [system-overview.md](../system-overview.md) maps each feature to its files.

## Files in this folder

| File | Migration | Tasks |
|---|---|---|
| [m1-rbac.md](m1-rbac.md) | M1: users, groups, roles, permissions, token hook, guards | PSI-012 – PSI-015 |
| [m2-notifications.md](m2-notifications.md) | M2: notifications, push subscriptions, `internal_post()` | PSI-020 |
| [m3-role-mail.md](m3-role-mail.md) | M3: role/group mail | PSI-030 |
| [m4-calendar.md](m4-calendar.md) | M4: events, audiences, ICS helpers | PSI-040, PSI-044 |
| [m5-kanban.md](m5-kanban.md) | M5: boards, columns, tasks | PSI-050 |
| [m6-google.md](m6-google.md) | M6: Drive mirror, calendar links | PSI-061 |
| [m7-activity-log.md](m7-activity-log.md) | M7: activity log | PSI-070 |
| [m8-agent-layer.md](m8-agent-layer.md) | M8: agent views, audit log, digests | PSI-071 |
| [m9-talent.md](m9-talent.md) | M9: talent (outline) | PSI-080 |
| [testing-pgtap.md](testing-pgtap.md) | Test pattern + RBAC assertions | every DB task |

Logical names; the CLI prefixes real files with a timestamp (`supabase migration new rbac` → `supabase/migrations/<timestamp>_rbac.sql`). Order follows the build phases in the task list.

## SQL conventions (every migration)

1. **RLS in the same migration** as the table (C-05). A `using (true)` policy carries a comment saying why.
2. **Permissions, never slugs** (C-17): `(select public.has_permission('mail.send'))`, never `r.slug = 'admin'`.
3. **Wrap per-statement checks in `(select …)`** so Postgres evaluates them once, not once per row: `(select auth.uid())`, `(select public.has_permission('…'))`.
4. **SECURITY DEFINER functions** always `set search_path = ''`, fully qualify every name, and are the only way to cross an RLS boundary (e.g. breaking the `messages ↔ message_recipients` policy cycle).
5. **Grant deliberately.** Supabase grants `EXECUTE` on new public functions to `anon` and `authenticated`; revoke explicitly and grant only what the caller needs (`service_role` for resolvers that return emails, `authenticated` for counts and checks).
6. **Views for agents use `with (security_invoker = true)`**, otherwise they run as the owner and bypass RLS.
7. **Membership is read from tables, not JWT claims**, so revocation is immediate. Claims are for the UI only.
8. **No personal data in `activity_log.summary`, notification titles or agent views.** Emails leave the database only through service-role resolvers.
9. **Never edit an applied migration** (C-06). Fix forward with a new one.
10. **After every migration:** `supabase db reset`, `supabase test db`, `bun run db:types`.

## Helper catalogue

| Function | Defined in | Callable by | Use |
|---|---|---|---|
| `has_permission(key)` | M1 | authenticated | Every permission check in policies |
| `my_role_ids()` · `my_group_ids()` · `in_group(id)` | M1 | authenticated | Audience and visibility checks |
| `effective_role_ids(user)` | M1 | service_role | Direct roles ∪ roles via groups (suspended → none) |
| `users_with_permission(key)` | M1 | service_role | Digest receivers, last-admin guard |
| `can_grant_role(id)` · `can_grant_group(id)` | M1 | policies | No-escalation rule |
| `notify(users[], type, title, body, link)` | M2 | service_role, triggers | Create notifications (one push batch per statement) |
| `internal_post(target, path, body)` | M2 | triggers, cron | The only way SQL calls Edge Functions or Next.js |
| `mail_recipients(role, group)` | M3 | service_role | Target → people with emails |
| `mail_recipient_count(role, group)` | M3 | authenticated | Count for the compose UI |
| `can_see_event(id)` · `event_audience_user_ids(id)` · `events_for_user(...)` | M4 | authenticated / service_role | Agenda visibility, invites, ICS |
| `is_board_member(id)` · `is_board_owner(id)` | M5 | authenticated | Board visibility |
| `can_see_drive_root(id)` | M6 | authenticated | Document visibility |

## Scheduled jobs and internal calls

Every inward call goes through `internal_post()`, which reads base URLs and `internal_fn_secret` from Vault and fires pg_net after commit.

| Trigger | When | Calls |
|---|---|---|
| `daily-digest` cron | `0 23 * * *` UTC = 06:00 WIB | `internal_post('functions', 'daily-digest')` |
| `google-calendar-sync` cron | every 15 min | `internal_post('functions', 'google-calendar/sync')` |
| `google-drive-sync` cron | every 30 min | `internal_post('functions', 'google-drive/sync')` |
| `activity-retention` cron | `30 20 * * *` UTC = 03:30 WIB | deletes activity older than 180 days |
| `notifications-retention` cron | `45 20 * * *` UTC = 03:45 WIB | deletes read notifications older than 90 days |
| `notifications` insert (statement) | every batch | `internal_post('site', 'api/push/dispatch', {ids})` |
| `events` / `event_audience` change | on write | `internal_post('functions', 'google-calendar/push', {...})` |

```sql
select cron.schedule('daily-digest', '0 23 * * *',
  $$ select public.internal_post('functions', 'daily-digest') $$);
```

Long-running endpoints (`/sync`) answer `202` at once and keep working inside `EdgeRuntime.waitUntil(...)`, because pg_net stops waiting after its timeout.

## Adding a migration (checklist)

```bash
supabase migration new <name>          # never edit an existing file
# write SQL following the conventions above
supabase db reset                      # applies cleanly from zero
supabase test db                       # add tests in supabase/tests/<name>.test.sql
bun run db:types                       # regenerate and commit database.types.ts
```

In Claude Code with ECC, finish with a database review (the `database-reviewer` agent covers Postgres/Supabase). RLS, role, permission and destructive changes stop for a human (C-15).
