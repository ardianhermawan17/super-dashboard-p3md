# Local workflow and deploy

> **Scope:** Supabase CLI workflow, the `supabase/` layout, deploying functions and migrations, project settings, secrets.
> Index: [backend-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Local workflow, repo layout, deploy

```bash
supabase init                                  # once
supabase start                                 # local Postgres, Auth, Storage, Studio, Inbucket
supabase migration new rbac                    # → supabase/migrations/<timestamp>_rbac.sql
supabase db reset                              # re-apply every migration + seed.sql
bun run db:types                               # regenerate TypeScript types
supabase test db                               # pgTAP tests in supabase/tests
supabase functions new send-role-mail
supabase functions serve --env-file supabase/functions/.env
```

`package.json` scripts (PSI-008):

```json
{
  "db:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts",
  "db:reset": "supabase db reset"
}
```

```
supabase/
├── config.toml
├── seed.sql                   # fake users, roles, groups, local Vault secrets (never real data)
├── migrations/                # M1…M9, timestamped by the CLI
├── tests/                     # pgTAP: *.test.sql
└── functions/
    ├── _shared/               # http.ts (CORS + json), internal.ts (secret check), send.ts (batched mail), google.ts
    ├── send-role-mail/
    ├── resend-webhook/
    ├── admin-users/
    ├── google-drive/          # /sync · /file · /search
    ├── google-calendar/       # /sync · /push
    ├── daily-digest/
    └── parse-cv/
```

**Deploy** (PSI-091). JWT verification is on only where the caller is a signed-in user; the others check their own secret or signature:

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy send-role-mail                     # user JWT
supabase functions deploy admin-users                        # user JWT
supabase functions deploy resend-webhook --no-verify-jwt     # Svix signature
supabase functions deploy google-drive --no-verify-jwt       # /sync: internal secret · /file, /search: checks the user itself
supabase functions deploy google-calendar --no-verify-jwt    # internal secret
supabase functions deploy daily-digest --no-verify-jwt       # internal secret
supabase functions deploy parse-cv --no-verify-jwt           # internal secret
supabase secrets set RESEND_API_KEY=... MAIL_FROM="P3MD <noreply@your-domain.id>" RESEND_WEBHOOK_SECRET=... \
  ANTHROPIC_API_KEY=... INTERNAL_FN_SECRET=... SITE_URL=https://<your-site> \
  GOOGLE_SA_KEY_B64="$(base64 -w0 p3md-sync-key.json)"
```

## Project settings

| Setting | Value | Where / task |
|---|---|---|
| Region | Singapore | Project creation |
| JWT signing keys | **Asymmetric** (RS256/ES256) | Settings → JWT keys. Needed for JWKS verification in `/api/mcp` and OIDC ID tokens (PSI-074) |
| Access-token hook | `public.custom_access_token_hook` | `config.toml` + Auth → Hooks ([m1-rbac.md](../database-architecture/m1-rbac.md#access-token-hook)) |
| Before-user-created hook | `public.before_user_created_hook` (only with Google sign-in onboarding) | Auth → Hooks ([auth-and-onboarding.md](auth-and-onboarding.md)) |
| Custom SMTP | Resend SMTP; raise the Auth email rate limit | Auth → SMTP (PSI-011). The built-in email service only reaches your own team members |
| OAuth 2.1 server | Enabled, dynamic client registration on, consent URL `https://<site>/auth/consent` | Auth → OAuth Server (PSI-074) |
| Vault secrets | `project_url`, `site_url`, `internal_fn_secret` | Once per environment ([push-notifications.md](push-notifications.md#environment-variables)) |
| Extensions | `pg_net`, `pg_cron` (M2), `pg_trgm` (M6) | Migrations |
| Realtime | `tasks`, `board_columns` (M5), `notifications` (M2) | Migrations |

```toml
# supabase/config.toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```
