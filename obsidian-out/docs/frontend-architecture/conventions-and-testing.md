# Conventions and testing

> **Scope:** rules every frontend change follows, and how it is tested.
> Index: [frontend-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Conventions and guardrails

- **Permissions, not roles.** `requirePermission('mail.send')`, never `roles.includes('projectmanager')` (C-17).
- **Base UI, not Radix.** Use `render` for composition. When pasting code from Radix-based sources (big-calendar, older blocks), convert `asChild` before committing.
- **Server/client boundary.** Default to Server Components; add `'use client'` at the smallest leaf that needs state or effects. Any module touching a secret starts with `import 'server-only'`.
- **One Supabase client module per side.** No ad-hoc `createClient` calls in components.
- **UTC in, WIB out.** All timestamps cross the wire as UTC ISO strings; format for `Asia/Jakarta` at render time.
- **Mobile first for the PWA pages** (notifications, mail detail, agenda day view): they are what people open from a push.
- **Errors.** Server Actions return `{ ok: false, error }`; components show a toast. Unexpected throws hit the template's Sentry-wired error boundary.
- **Types.** Import row types from `database.types.ts` (`Database['public']['Tables']['events']['Row']`). Never redeclare a DB shape by hand.
- **Deep links** follow `/dashboard/<feature>/<id>` (query params for calendar and board items). Notifications and agent tools rely on this shape.

## Testing

| Layer | Tool | What |
|---|---|---|
| Pure logic | Vitest | `parseOneLiner`, `positionBetween`, rrule expansion, `visibleNav` |
| Flows | Playwright (smoke) | sign in → send mail to a test role and a test group → create an event with a group audience → move a card → open a document |
| Database | pgTAP (`supabase test db`) | RLS policies and RBAC guards ([testing-pgtap.md](../database-architecture/testing-pgtap.md), [testing-pgtap.md](../database-architecture/testing-pgtap.md)) |
| Devices | Manual | PWA install + push on Android and iPhone ([notifications-pwa.md](features/notifications-pwa.md#device-support-and-qa)) |

Keep the smoke suite under ~2 minutes so agents actually run it.
