# Admin pages

> **Scope:** users, groups, roles, permissions and integrations pages. Access model and SQL: [m1-rbac.md](../../database-architecture/m1-rbac.md) · invite/suspend: [edge-functions.md](../../backend-architecture/edge-functions.md#admin-users-psi-018).
> Index: [frontend-architecture/](../README.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)

Pages under `/dashboard/admin/`, each guarded with `requirePermission()`. Role and group assignment are plain Server Actions (RLS enforces the no-escalation rule); invite and suspend call the `admin-users` Edge Function. Access model: [m1-rbac.md](../../database-architecture/m1-rbac.md) · invite/suspend: [edge-functions.md](../../backend-architecture/edge-functions.md#admin-users-psi-018).

## Admin pages

The users table reads emails and last sign-in through `admin_list_users()` ([m1-rbac.md](../../database-architecture/m1-rbac.md#admin-helpers)), because PostgREST cannot read `auth.users`.

All under `/dashboard/admin/`, built with the template's data-table and TanStack Form patterns.

| Page | Permission | Features |
|---|---|---|
| **Users** | `users.read` (view), `users.manage` (act) | Table: name, email, groups, roles (badge "via group X" for inherited), status, last sign-in. Actions: invite one, import CSV (email, name, groups, roles), suspend, reactivate, edit roles/groups |
| **Groups** | `groups.manage` | Create/edit; members (add, remove, paste a list of emails); roles the group grants (needs `roles.manage`) |
| **Roles** | `roles.manage` | Create/edit; permission matrix grouped by module (checkboxes you can't grant are disabled); holders count (direct + via groups) |
| **Permissions** | `roles.manage` | Read-only catalogue: key, module, description, which roles grant it |
| **Integrations** | `integrations.manage` or `documents.manage` (view), `integrations.manage` (act) | Service Account email with copy-to-clipboard, because operators must share Drive folders and calendars with it. Drive Roots tab: name, folder id, granted roles/groups, enabled, last sync, last error; add/edit/delete and per-root sync. Linked Calendars tab: calendar id, direction (`pull`/`push`/`both`), one bound role **or** group, enabled, last sync; link/edit/delete and per-calendar sync. See [documents.md](documents.md) and [calendar.md](calendar.md) |

The Integrations page re-checks `integrations.manage` inside every mutating Server Action rather than relying on the page-level gate, and mirrors the schema's XOR rule (a Drive root access grant and a calendar binding each target exactly one role or one group). Its "Sync now" buttons post to the Edge Functions owned by PSI-062/065/066 and currently no-op while those are undeployed. Source: [m6-google.md](../../database-architecture/m6-google.md).

Every page shows the note: *changes apply immediately to data access; menus update after the user's next token refresh.*

## Integrations page

- Shows the SA email with a copy button ("share folders and calendars with this address").
- Drive roots: add by folder URL or ID, name, access (roles/groups), enable/disable, last sync, last error, "Sync now".
- Calendars: add by calendar ID, direction, role/group, last sync, last error, "Sync now".
