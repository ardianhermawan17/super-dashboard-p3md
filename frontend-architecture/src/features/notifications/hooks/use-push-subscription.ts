'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  enablePush,
  getCurrentPushSubscription,
  isPushSupported,
  needsInstallFirst,
  unsubscribePush
} from '../lib/push';

export function usePushSubscription() {
  const [isSupported, setIsSupported] = React.useState(false);
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [needsInstall, setNeedsInstall] = React.useState(false);
  const [permission, setPermission] = React.useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const supported = isPushSupported();
    setIsSupported(supported);
    setNeedsInstall(needsInstallFirst());

    if (supported) {
      setPermission(Notification.permission);
      getCurrentPushSubscription().then((sub) => {
        setIsSubscribed(Boolean(sub));
      });
    }
  }, []);

  const handleEnable = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await enablePush();
      if (res.ok) {
        setIsSubscribed(true);
        setPermission('granted');
        toast.success('Push notifications enabled for this device.');
      } else {
        toast.error(res.reason ?? 'Failed to enable push notifications.');
      }
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUnsubscribe = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await unsubscribePush();
      if (res.ok) {
        setIsSubscribed(false);
        toast.success('Push notifications disabled on this device.');
      } else {
        toast.error(res.reason ?? 'Failed to unsubscribe.');
      }
    } catch {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    needsInstall,
    permission,
    isLoading,
    enable: handleEnable,
    unsubscribe: handleUnsubscribe
  };
}
