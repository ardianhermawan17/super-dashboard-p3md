# Operations and risks

> **Scope:** security controls, quotas, free-tier operations, and open risks to verify.
> Index: [backend-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Security, privacy, quotas and free tier

| Concern | Control |
|---|---|
| Secret key exposure | Only in Edge Functions, the ICS route and the push dispatcher; never `NEXT_PUBLIC_*` (C-04) |
| Access changes | RLS reads membership tables, so revoking a role, group or suspending a user applies on the next request |
| Email addresses | Leave the DB only inside `send-role-mail` and `admin-users`; never stored in app tables |
| CV data (UU PDP) | Consent row, private bucket or restricted Drive root, originals deleted after parse, no raw text persisted, agent views without PII |
| Documents | Streamed after an RLS check, every open logged in `document_views`, never cached server-side, never in agent output (C-18) |
| Agent over-reach | Read-only tools, user-scoped JWT, `security_invoker` views, `agent_audit_log`, revoke via Connected apps |
| Prompt injection | Mail bodies, task text and documents are user content; with no write tools in v1, an injected instruction has nothing to trigger |
| Internal endpoints | `INTERNAL_FN_SECRET` on every pg_net call; rotate it in Vault, Edge Function secrets and Vercel together |

**Quotas to plan for (check current numbers before launch):**

| Service | Watch out for | Mitigation |
|---|---|---|
| Supabase Auth email | Built-in sender reaches only team members and is rate-limited | Custom SMTP (Resend), raise the Auth email rate limit, or Google sign-in onboarding |
| Resend | Free plan daily/monthly caps are far below "400 people × several mails" | Push-first notifications; email only for role mail; paid plan if volume demands |
| Web Push | Payload ≤ ~4 KB; iOS needs an installed PWA | Short titles, deep links instead of content |
| Google APIs | Per-project request quotas | Window rescans are a handful of calls; back off on 403/429 |
| Vercel functions | Max duration per plan | Dispatch pool of 20; `maxDuration = 60` |

**Free tier** (500 MB DB, 1 GB storage, pause after 7 days without activity):

- Retention jobs for `activity_log` (180 days) and read notifications (90 days).
- Documents stay in Drive; CVs capped at 2 MB and deleted after parsing (or kept in Drive).
- Keep-alive ping from GitHub Actions (PSI-092):

```yaml
# .github/workflows/keepalive.yml
on:
  schedule: [{ cron: '0 1 */3 * *' }]
  workflow_dispatch: {}
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS "$URL/rest/v1/permissions?select=key&limit=1" -H "apikey: $KEY" > /dev/null
        env:
          URL: ${{ secrets.SUPABASE_URL }}
          KEY: ${{ secrets.SUPABASE_PUBLISHABLE_KEY }}
```

## Open risks to verify

| Risk | Why it matters | Check (task) |
|---|---|---|
| MCP spec 2026-07-28 deprecates Dynamic Client Registration in favor of Client ID Metadata Documents (CIMD) | Newer clients may expect CIMD from the authorization server | Inspect `https://<ref>.supabase.co/auth/v1/.well-known/oauth-authorization-server` for `client_id_metadata_document_supported`; test Claude and ChatGPT connectors (PSI-078) |
| OAuth token `aud` claim | `verifySupabaseToken` checks issuer and role only; tighten once the real `aud` is confirmed | PSI-073 |
| Resend batch limits and webhook payload shape | Hard-coded `BATCH_SIZE` and event mapping | PSI-032, PSI-033 |
| Service-account key creation blocked by org policy | Google integration cannot start | PSI-060 (Workspace admin) |
| Before-user-created hook payload shape | Allowlist onboarding depends on it | PSI-016 |
| Realtime at scale | `postgres_changes` re-checks RLS per subscriber | Move busy boards to Realtime Broadcast if needed |
| JWT claim staleness in the UI | Menus lag behind role changes until token refresh | Documented on admin pages (PSI-018, PSI-019) |
