'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import type { MailThread, RecipientDelivery, RoleMailMessage } from './types';

export async function getMailInboxData(): Promise<{ threads: MailThread[] }> {
  const session = await getSession();
  if (!session) return { threads: [] };
  const supabase = await createClient();

  const [
    { data: messagesData },
    { data: rolesData },
    { data: groupsData },
    { data: profilesData }
  ] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase.from('roles').select('id, slug, name'),
    supabase.from('groups').select('id, slug, name'),
    supabase.from('profiles').select('id, full_name')
  ]);

  if (!messagesData || messagesData.length === 0) {
    return { threads: [] };
  }

  const roleMap = new Map((rolesData ?? []).map((r) => [r.id, r]));
  const groupMap = new Map((groupsData ?? []).map((g) => [g.id, g]));
  const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p.full_name]));

  const enrichedMessages: RoleMailMessage[] = messagesData.map((m) => {
    const isRole = Boolean(m.to_role_id);
    const role = m.to_role_id ? roleMap.get(m.to_role_id) : undefined;
    const group = m.to_group_id ? groupMap.get(m.to_group_id) : undefined;

    return {
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.is_system ? 'System' : (m.sender_id ? profileMap.get(m.sender_id) ?? 'Unknown Sender' : 'System'),
      is_system: m.is_system,
      to_role_id: m.to_role_id,
      to_role_name: role?.name ?? null,
      to_group_id: m.to_group_id,
      to_group_name: group?.name ?? null,
      target_kind: isRole ? 'role' : 'group',
      target_name: isRole ? (role?.name ?? 'Role') : (group?.name ?? 'Group'),
      target_slug: isRole ? (role?.slug ?? 'role') : (group?.slug ?? 'group'),
      subject: m.subject,
      body_md: m.body_md,
      status: m.status,
      created_at: m.created_at,
      sent_at: m.sent_at
    };
  });

  // Group by target role or group
  const threadMap = new Map<string, RoleMailMessage[]>();
  for (const msg of enrichedMessages) {
    const threadKey = `${msg.target_kind}:${msg.to_role_id ?? msg.to_group_id}`;
    const list = threadMap.get(threadKey) ?? [];
    list.push(msg);
    threadMap.set(threadKey, list);
  }

  const threads: MailThread[] = Array.from(threadMap.entries()).map(([threadId, msgs]) => {
    const first = msgs[0];
    return {
      id: threadId,
      target_kind: first.target_kind,
      target_id: (first.to_role_id ?? first.to_group_id)!,
      target_name: first.target_name,
      target_slug: first.target_slug,
      messages: msgs,
      last_message: first
    };
  });

  return { threads };
}

export async function getMessageRecipientsData(messageId: string): Promise<{
  recipients: RecipientDelivery[];
}> {
  const session = await getSession();
  if (!session) return { recipients: [] };
  const supabase = await createClient();

  const [{ data: recsData }, { data: profilesData }] = await Promise.all([
    supabase
      .from('message_recipients')
      .select('message_id, user_id, delivery_status, updated_at')
      .eq('message_id', messageId),
    supabase.from('profiles').select('id, full_name')
  ]);

  if (!recsData) return { recipients: [] };

  const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p.full_name]));

  const recipients: RecipientDelivery[] = recsData.map((r) => ({
    user_id: r.user_id,
    user_name: profileMap.get(r.user_id) ?? 'Member',
    delivery_status: r.delivery_status as RecipientDelivery['delivery_status'],
    updated_at: r.updated_at
  }));

  return { recipients };
}
