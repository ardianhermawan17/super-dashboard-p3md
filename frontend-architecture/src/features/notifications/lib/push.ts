'use client';

import { createClient } from '@/lib/supabase/client';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function needsInstallFirst(): boolean {
  if (typeof window === 'undefined') return false;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  return isIOS && !isStandalone;
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) {
    return { ok: false, reason: 'Push notifications are not supported by this browser.' };
  }

  if (needsInstallFirst()) {
    return {
      ok: false,
      reason: 'iOS requires adding this app to your Home Screen before enabling notifications.'
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: `Notification permission was ${permission}.` };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    return { ok: false, reason: 'VAPID public key is not configured.' };
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    await navigator.serviceWorker.ready;

    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });
    }

    const subJson = sub.toJSON();
    if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
      return { ok: false, reason: 'Failed to extract push subscription keys.' };
    }

    const supabase = createClient();
    const { error } = await supabase.rpc('register_push_subscription', {
      p_endpoint: subJson.endpoint,
      p_p256dh: subJson.keys.p256dh,
      p_auth: subJson.keys.auth,
      p_user_agent: navigator.userAgent
    });

    if (error) {
      return { ok: false, reason: error.message };
    }

    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown push registration error';
    return { ok: false, reason: msg };
  }
}

export async function unsubscribePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: true };

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      const supabase = createClient();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to unsubscribe';
    return { ok: false, reason: msg };
  }
}
