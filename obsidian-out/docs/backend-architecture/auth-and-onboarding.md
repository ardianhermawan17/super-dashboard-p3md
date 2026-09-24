# Auth and onboarding

> **Scope:** Supabase Auth configuration (hooks, SMTP, providers), onboarding ~400 users, and Supabase as the OAuth 2.1 server for external agents.
> Hook SQL: [m1-rbac.md](../database-architecture/m1-rbac.md) · Index: [backend-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Auth settings

| Setting | Value | Task |
|---|---|---|
| Access-token hook | `public.custom_access_token_hook` (adds `app_roles`, `app_groups`, `app_permissions` for the UI) | PSI-013 |
| Before-user-created hook | `public.before_user_created_hook` (only with Google sign-in onboarding) | PSI-016 |
| Custom SMTP | Resend SMTP; raise the Auth email rate limit | PSI-011 |
| Google provider | Basic scopes `openid email profile` (only with option B below) | PSI-016 |
| JWT signing keys | Asymmetric (RS256/ES256) | PSI-074 |
| OAuth 2.1 server | Enabled for MCP clients (below) | PSI-074 |

```toml
# supabase/config.toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

In production enable the hooks under Dashboard → Authentication → Hooks.

## Onboarding ~400 users

Both options pre-provision access in `user_invites`, so each person lands with the right groups and roles on first sign-in.

**Option A · Email invites.** `admin-users` sends Supabase invite emails.
- Custom SMTP is mandatory: Supabase's built-in email service only delivers to your own team members and is heavily rate-limited. Configure Resend SMTP under Authentication → SMTP, then raise the Auth email rate limit.
- Mind the Resend plan: 400 invites plus role mail will not fit a free daily quota (check current limits); send in daily batches or use a paid plan.

**Option B · Sign in with Google + allowlist (recommended if everyone has a Google account).** No invite emails at all.
- Enable the Google provider in Supabase Auth (basic scopes only: `openid email profile`, so no Google app verification burden).
- Add a **before-user-created** Auth hook that rejects emails not in `user_invites`:
  SQL: [m1-rbac.md → auth hooks](../database-architecture/m1-rbac.md#auth-hooks).

Verify the hook's payload shape against Supabase's Auth Hooks docs when implementing (PSI-016). The admin imports the CSV once; people sign in with Google whenever they like.

## Supabase as the OAuth 2.1 server for agents (PSI-074)

1. Switch the project to asymmetric JWT signing keys ([local-workflow-and-deploy.md](local-workflow-and-deploy.md#project-settings)).
2. Auth → OAuth Server: enable it, allow dynamic OAuth apps, set the consent URL to `https://<site>/auth/consent`.
3. Build `/auth/consent`: read the `authorization_id` query param, fetch the request details, show "**<client>** wants read access to your P3MD data" with Approve / Deny, and call the matching approve/deny method (supabase-js `auth.oauth` API; follow Supabase's "OAuth 2.1 Server → Getting started" guide for exact method names).
4. Supabase auto-approves repeat authorizations after the first consent, so the Connected apps page ([ai-chat.md](../frontend-architecture/features/ai-chat.md#connected-apps)) with revoke is mandatory.
5. Test end to end against the **hosted** project: local discovery through the path-insertion URL can 404.
6. Tokens issued to MCP clients are normal Supabase JWTs with `user_id`, `role` and `client_id`. RLS applies automatically; a policy can narrow agent access further with `auth.jwt() ->> 'client_id'`.
