'use server';

import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import type { NotificationPref, PushSubscriptionDevice } from './types';

export async function getNotificationSettingsAction(): Promise<{
  prefs: NotificationPref[];
  devices: PushSubscriptionDevice[];
}> {
  const session = await getSession();
  if (!session) return { prefs: [], devices: [] };
  const supabase = await createClient();

  const [{ data: prefsData }, { data: devicesData }] = await Promise.all([
    supabase.from('notification_prefs').select('type, push').eq('user_id', session.userId),
    supabase
      .from('push_subscriptions')
      .select('id, endpoint, user_agent, created_at, last_success_at')
      .eq('user_id', session.userId)
      .order('created_at', { ascending: false })
  ]);

  return {
    prefs: (prefsData ?? []) as NotificationPref[],
    devices: (devicesData ?? []) as PushSubscriptionDevice[]
  };
}

export async function toggleNotificationPrefAction(type: string, push: boolean) {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const { error } = await supabase
    .from('notification_prefs')
    .upsert({ user_id: session.userId, type, push }, { onConflict: 'user_id,type' });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/notifications');
  return { ok: true };
}

export async function deletePushSubscriptionAction(subscriptionId: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('id', subscriptionId)
    .eq('user_id', session.userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/notifications');
  return { ok: true };
}

export async function markNotificationReadAction(notificationId: string) {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', session.userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/notifications');
  return { ok: true };
}

export async function markAllNotificationsReadAction() {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Unauthorized' };
  const supabase = await createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', session.userId)
    .is('read_at', null);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/dashboard/notifications');
  return { ok: true };
}
