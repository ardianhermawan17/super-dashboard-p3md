# Edge Functions

> **Scope:** the Deno functions that call external services or need the service role. Google functions have their own file.
> Google: [google-integration.md](google-integration.md) · Index: [backend-architecture/](README.md) · Gateway: [README_AI_AGENT.md](../../README_AI_AGENT.md)

## Shared modules

Shared modules in `functions/_shared/`: `http.ts` (CORS headers + `json()`; every browser-facing function answers `OPTIONS`), `internal.ts` (`assertInternal(req)` compares the bearer with `INTERNAL_FN_SECRET`), `send.ts` (batched Resend sending, used by mail and invites), `google.ts` (service-account tokens), `llm.ts` (Claude or Hermes completions, see [agent-layer-mcp.md](agent-layer-mcp.md#llm-providers-claude-and-hermes-psi-098)).

## `send-role-mail` (PSI-032)

```ts
// supabase/functions/send-role-mail/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Resend } from 'npm:resend@4';
import { marked } from 'npm:marked@14';
import { cors, json } from '../_shared/http.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;              // or the new publishable key
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;   // or the new secret key
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const FROM = Deno.env.get('MAIL_FROM')!;                         // "P3MD <noreply@your-domain.id>"
const BATCH_SIZE = 100;                                           // Resend batch cap per request: re-check their docs

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const { messageId } = await req.json().catch(() => ({}));
  if (typeof messageId !== 'string') return json({ error: 'messageId required' }, 400);

  // 1. Act as the caller: RLS proves they can see the message; has_permission proves they may send.
  const asUser = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: canSend } = await asUser.rpc('has_permission', { p_key: 'mail.send' });
  if (!canSend) return json({ error: 'forbidden' }, 403);
  const { data: msg } = await asUser
    .from('messages').select('id, subject, body_md, to_role_id, to_group_id').eq('id', messageId).single();
  if (!msg) return json({ error: 'not found' }, 404);

  // 2. Claim atomically: a double click never sends twice.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: claimed } = await admin
    .from('messages').update({ status: 'sending' }).eq('id', messageId).eq('status', 'queued').select('id');
  if (!claimed?.length) return json({ error: 'already processed' }, 409);

  // 3. Target → people (service_role-only function; includes role holders via groups).
  const { data: recipients, error: rErr } = await admin.rpc('mail_recipients', {
    p_role_id: msg.to_role_id, p_group_id: msg.to_group_id,
  });
  if (rErr || !recipients?.length) {
    await admin.from('messages').update({ status: 'failed' }).eq('id', messageId);
    return json({ error: rErr?.message ?? 'target has no active members' }, 422);
  }

  // 4. One email per person (no shared To/BCC), in batches.
  const html = await marked.parse(msg.body_md);
  const rows: { message_id: string; user_id: string; provider_message_id: string | null; delivery_status: string }[] = [];
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const { data, error } = await resend.batch.send(
      chunk.map((r: { email: string }) => ({ from: FROM, to: [r.email], subject: msg.subject, html })),
    );
    chunk.forEach((r: { user_id: string }, j: number) =>
      rows.push({
        message_id: messageId,
        user_id: r.user_id,
        provider_message_id: data?.data?.[j]?.id ?? null,
        delivery_status: error ? 'failed' : 'sent',
      }),
    );
  }
  await admin.from('message_recipients').upsert(rows);

  // 5. In-app + push notification for every recipient (one insert → one push dispatch).
  await admin.rpc('notify', {
    p_users: recipients.map((r: { user_id: string }) => r.user_id),
    p_type: 'mail.received',
    p_title: msg.subject,
    p_body: null,
    p_link: `/dashboard/mail/${messageId}`,
  });

  const allFailed = rows.every((r) => r.delivery_status === 'failed');
  await admin.from('messages')
    .update({ status: allFailed ? 'failed' : 'sent', sent_at: new Date().toISOString() })
    .eq('id', messageId);
  return json({ ok: !allFailed, recipients: rows.length });
});
```

## `resend-webhook` (PSI-033)

```ts
// supabase/functions/resend-webhook/index.ts
import { Webhook } from 'npm:svix@1';
import { createClient } from 'npm:@supabase/supabase-js@2';

const wh = new Webhook(Deno.env.get('RESEND_WEBHOOK_SECRET')!);
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const MAP: Record<string, string> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

Deno.serve(async (req) => {
  const payload = await req.text();
  let event: { type: string; data: { email_id: string } };
  try {
    event = wh.verify(payload, {
      'svix-id': req.headers.get('svix-id') ?? '',
      'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
      'svix-signature': req.headers.get('svix-signature') ?? '',
    }) as typeof event;
  } catch {
    return new Response('invalid signature', { status: 400 });
  }
  const status = MAP[event.type];
  if (status) {
    await admin.from('message_recipients')
      .update({ delivery_status: status, updated_at: new Date().toISOString() })
      .eq('provider_message_id', event.data.email_id);
  }
  return new Response('ok');
});
```

Check the event names and payload shape against Resend's webhook docs when implementing; the mapping table is the only thing that should change.

## `admin-users` (PSI-018)

Suspending and inviting need the Auth admin API (service role), so they live in an Edge Function. Role and group assignment does **not**: the Server Action inserts rows as the admin user and RLS enforces the guards.

```ts
// supabase/functions/admin-users/index.ts  (deployed with JWT verification)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { cors, json } from '../_shared/http.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: allowed } = await asUser.rpc('has_permission', { p_key: 'users.manage' });
  if (!allowed) return json({ error: 'forbidden' }, 403);

  const body = await req.json();
  switch (body.action) {
    case 'invite': {
      // 1. Store invites AS THE USER: RLS applies the escalation checks to role_ids / group_ids.
      const { error } = await asUser.from('user_invites').upsert(body.invites);
      if (error) return json({ error: error.message }, 400);
      // 2. Send invite emails (option A only; with option B users just sign in with Google).
      if (body.sendEmail) {
        for (const inv of body.invites) {
          await admin.auth.admin.inviteUserByEmail(inv.email, {
            redirectTo: `${Deno.env.get('SITE_URL')}/auth/confirm`,
            data: { full_name: inv.full_name },
          });
          await new Promise((r) => setTimeout(r, 250)); // stay under the Auth email rate limit
        }
      }
      return json({ ok: true, invited: body.invites.length });
    }
    case 'suspend':
    case 'reactivate': {
      const suspend = body.action === 'suspend';
      await admin.auth.admin.updateUserById(body.userId, { ban_duration: suspend ? '876000h' : 'none' });
      const { error } = await admin.from('profiles')
        .update({ status: suspend ? 'suspended' : 'active' }).eq('id', body.userId);
      if (error) return json({ error: error.message }, 409);   // e.g. last-admin guard
      return json({ ok: true });
    }
    default:
      return json({ error: 'unknown action' }, 400);
  }
});
```

`_shared/http.ts` exports the CORS headers (browser calls send `Authorization`, which triggers a preflight) and the `json()` helper; every browser-facing function uses it.

## `daily-digest` (PSI-077)

1. `assertInternal(req)`.
2. Service client reads `activity_log` for the last 24 h (summaries only, no personal data by construction).
3. `complete(DIGEST_MODEL, …)` from `_shared/llm.ts` with a fixed prompt ("summarize for project managers; blockers first; group by board, agenda, mail"). Default `anthropic:claude-haiku-4-5-20251001`; a Hermes model is a drop-in alternative.
4. Insert into `digests`, then `notify(users_with_permission('digest.receive'), 'digest.ready', …)`. The digest is read on the Overview page and arrives as a push, so no email quota is spent.

## `parse-cv` (PSI-082, outline)

1. Triggered after CV intake with `{ candidate_id }` (internal secret).
2. Load the file: Storage (`cv_source = 'storage'`) or Drive through the service account (`cv_source = 'drive'`).
3. Extract the PDF text layer; OCR only if it is empty.
4. `complete(CV_MODEL, …)` asking for strict JSON `{ skills: [{ name, confidence, evidence, years }] }`; validate against the schema before use. The provider for CV text is a human decision (C-15).
5. Normalize names through `skill_aliases`; unknown names go to a review queue, never auto-created.
6. Upsert `candidate_skills`, set `parsed_at`. Storage originals are deleted and `cv_path` nulled (PSI-086).
7. Raw text is never persisted and never logged.
