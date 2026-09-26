'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { NotificationCard } from '@/components/ui/notification-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNotificationStore } from '../utils/store';
import { EnablePushButton } from './enable-push-button';
import { NotificationPrefsForm } from './notification-prefs-form';
import { getNotificationSettingsAction } from '../actions';
import type { NotificationPref, PushSubscriptionDevice } from '../types';

const actionRoutes: Record<string, string> = {
  view: '/dashboard/overview',
  'view-product': '/dashboard/overview',
  billing: '/dashboard/overview',
  open: '/dashboard/kanban',
  'open-chat': '/dashboard/chat'
};

export default function NotificationsPage() {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotificationStore();
  const router = useRouter();
  const count = unreadCount();

  const [settings, setSettings] = React.useState<{
    prefs: NotificationPref[];
    devices: PushSubscriptionDevice[];
  }>({ prefs: [], devices: [] });

  React.useEffect(() => {
    getNotificationSettingsAction().then((res) => {
      setSettings(res);
    });
  }, []);

  const unreadNotifications = notifications.filter((n) => n.status === 'unread');
  const readNotifications = notifications.filter((n) => n.status === 'read');

  const renderList = (items: typeof notifications) => {
    if (items.length === 0) {
      return (
        <div className='flex flex-col items-center justify-center py-16'>
          <Icons.notification className='text-muted-foreground/40 mb-3 h-10 w-10' />
          <p className='text-muted-foreground text-sm'>No notifications</p>
        </div>
      );
    }

    return (
      <div className='flex flex-col gap-2'>
        {items.map((notification) => (
          <NotificationCard
            key={notification.id}
            id={notification.id}
            title={notification.title}
            body={notification.body}
            status={notification.status}
            createdAt={notification.createdAt}
            actions={notification.actions}
            onMarkAsRead={(id) => markAsRead(id)}
            onAction={(notifId, actionId) => {
              const route = actionRoutes[actionId];
              if (route) {
                markAsRead(notifId);
                router.push(route);
              }
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <PageContainer
      pageTitle='Notifications'
      pageDescription='View notifications and manage your device push preferences.'
      pageHeaderAction={
        count > 0 ? (
          <Button variant='outline' size='sm' onClick={markAllAsRead}>
            Mark all as read
          </Button>
        ) : undefined
      }
    >
      <div className='space-y-6'>
        <EnablePushButton />

        <Tabs defaultValue='all'>
          <TabsList>
            <TabsTrigger value='all'>All ({notifications.length})</TabsTrigger>
            <TabsTrigger value='unread'>Unread ({unreadNotifications.length})</TabsTrigger>
            <TabsTrigger value='read'>Read ({readNotifications.length})</TabsTrigger>
            <TabsTrigger value='preferences'>Preferences & Devices</TabsTrigger>
          </TabsList>
          <TabsContent value='all' className='mt-4'>
            {renderList(notifications)}
          </TabsContent>
          <TabsContent value='unread' className='mt-4'>
            {renderList(unreadNotifications)}
          </TabsContent>
          <TabsContent value='read' className='mt-4'>
            {renderList(readNotifications)}
          </TabsContent>
          <TabsContent value='preferences' className='mt-4'>
            <NotificationPrefsForm prefs={settings.prefs} devices={settings.devices} />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
