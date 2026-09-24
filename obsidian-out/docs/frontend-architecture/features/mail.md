# Role and group mail (the one-liner)

> **Scope:** inbox, compose and the `to:` one-liner. Schema: [m3-role-mail.md](../../database-architecture/m3-role-mail.md) · sending: [edge-functions.md](../../backend-architecture/edge-functions.md#send-role-mail-psi-032).
> Index: [frontend-architecture/](../README.md) · Gateway: [README_AI_AGENT.md](../../../README_AI_AGENT.md)

Routes: `/dashboard/mail` (inbox: messages you sent or received), `/dashboard/mail/[id]`, `/dashboard/mail/compose`.

- **Targets:** a role (`to:projectmanager`) or a group (`to:group:pflp-batch-7`). Role targets include people who hold the role through a group.
- **Inbox:** reuse the template chat layout (conversation list → message list → detail). A "conversation" is a target role or group.
- **One-liner input** at the top of the inbox opens compose with target and subject filled in:

```ts
// src/features/role-mail/lib/one-liner.ts
const ONE_LINER = /^to:(?:(group):)?([a-z0-9-]+)\s+(.+)$/i;

export type OneLiner = { kind: 'role' | 'group'; slug: string; subject: string };

export function parseOneLiner(input: string): OneLiner | null {
  const m = input.trim().match(ONE_LINER);
  if (!m) return null;
  return { kind: m[1] ? 'group' : 'role', slug: m[2].toLowerCase(), subject: m[3].trim() };
}
```

- **Compose:** target combobox (roles and groups, labelled), live recipient count via `rpc('mail_recipient_count')` (a count, never emails), subject, Markdown body with preview. Needs `mail.send`.
- **Send:** Server Action `sendRoleMail` inserts the message with `status: 'queued'`, then calls `db.functions.invoke('send-role-mail', { body: { messageId } })` with the user's session. The Edge Function resolves recipients, emails them and creates `mail.received` notifications ([edge-functions.md](../../backend-architecture/edge-functions.md#send-role-mail-psi-032)). Delivery statuses arrive through the Resend webhook; the detail view shows them per recipient.
- **Command palette:** a kbar action "Email a role or group…" routes to compose.
