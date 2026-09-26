'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { NotificationCard } from '@/components/ui/notification-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotificationStore, type Notification } from '../utils/store';
import { useNotificationFeed } from '../hooks/use-notification-feed';
import { EnablePushButton } from './enable-push-button';
import { NotificationPrefsForm } from './notification-prefs-form';
import { getNotificationsAction, getNotificationSettingsAction } from '../actions';
import { createClient } from '@/lib/supabase/client';
import type { NotificationPref, PushSubscriptionDevice } from '../types';

const isToday = (dateStr: string) => {
  const date = new Date(dateStr);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, setNotifications } =
    useNotificationStore();
  const router = useRouter();
  const [userId, setUserId] = React.useState<string | null>(null);
  const [typeFilter, setTypeFilter] = React.useState<string>('all');

  const [settings, setSettings] = React.useState<{
    prefs: NotificationPref[];
    devices: PushSubscriptionDevice[];
  }>({ prefs: [], devices: [] });

  const fetchItems = React.useCallback(async () => {
    const res = await getNotificationsAction();
    const mapped: Notification[] = res.notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      status: n.read_at ? 'read' : 'unread',
      createdAt: n.created_at,
      link: n.link,
      type: n.type,
      actions: n.link
        ? [
            {
              id: 'view',
              label: 'Open link',
              type: 'redirect',
              style: 'primary'
            }
          ]
        : undefined
    }));
    setNotifications(mapped, res.unreadCount);
  }, [setNotifications]);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
    fetchItems();
    getNotificationSettingsAction().then((res) => {
      setSettings(res);
    });
  }, [fetchItems]);

  useNotificationFeed(userId, fetchItems);

  const filteredByType = React.useMemo(() => {
    if (typeFilter === 'all') return notifications;
    return notifications.filter((n) => n.type === typeFilter);
  }, [notifications, typeFilter]);

  const unreadNotifications = filteredByType.filter((n) => n.status === 'unread');
  const readNotifications = filteredByType.filter((n) => n.status === 'read');

  const renderGroupedList = (items: Notification[]) => {
    if (items.length === 0) {
      return (
        <div className='flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-card'>
          <Icons.notification className='text-muted-foreground/40 mb-3 h-10 w-10' />
          <p className='text-muted-foreground text-sm font-medium'>No notifications found</p>
          <p className='text-muted-foreground/80 text-xs mt-1'>
            You are all caught up on updates.
          </p>
        </div>
      );
    }

    const todayItems = items.filter((n) => isToday(n.createdAt));
    const earlierItems = items.filter((n) => !isToday(n.createdAt));

    return (
      <div className='space-y-6'>
        {todayItems.length > 0 && (
          <div className='space-y-2'>
            <h4 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1'>
              Today
            </h4>
            <div className='flex flex-col gap-2'>
              {todayItems.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  id={notification.id}
                  title={notification.title}
                  body={notification.body ?? ''}
                  status={notification.status}
                  createdAt={notification.createdAt}
                  actions={notification.actions}
                  onMarkAsRead={(id) => markAsRead(id)}
                  onAction={(notifId) => {
                    const item = notifications.find((n) => n.id === notifId);
                    markAsRead(notifId);
                    if (item?.link) {
                      router.push(item.link);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {earlierItems.length > 0 && (
          <div className='space-y-2'>
            <h4 className='text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1'>
              Earlier
            </h4>
            <div className='flex flex-col gap-2'>
              {earlierItems.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  id={notification.id}
                  title={notification.title}
                  body={notification.body ?? ''}
                  status={notification.status}
                  createdAt={notification.createdAt}
                  actions={notification.actions}
                  onMarkAsRead={(id) => markAsRead(id)}
                  onAction={(notifId) => {
                    const item = notifications.find((n) => n.id === notifId);
                    markAsRead(notifId);
                    if (item?.link) {
                      router.push(item.link);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageContainer
      pageTitle='Notification Center'
      pageDescription='Real-time alerts, quick shortcuts, and push device preferences.'
      pageHeaderAction={
        unreadCount > 0 ? (
          <Button variant='outline' size='sm' onClick={markAllAsRead}>
            Mark all as read
          </Button>
        ) : undefined
      }
    >
      <div className='space-y-6'>
        {/* Quick Links Navigation Bar */}
        <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
          <Link
            href='/dashboard/calendar'
            className='flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors shadow-xs group'
          >
            <div className='h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0'>
              <Icons.calendar className='h-4 w-4' />
            </div>
            <div>
              <div className='text-xs font-medium text-foreground group-hover:text-primary transition-colors'>
                Agenda Today
              </div>
              <div className='text-[11px] text-muted-foreground'>View scheduled events</div>
            </div>
          </Link>

          <Link
            href='/dashboard/mail'
            className='flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors shadow-xs group'
          >
            <div className='h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0'>
              <Icons.mail className='h-4 w-4' />
            </div>
            <div>
              <div className='text-xs font-medium text-foreground group-hover:text-primary transition-colors'>
                Role Mail
              </div>
              <div className='text-[11px] text-muted-foreground'>Check inbox & updates</div>
            </div>
          </Link>

          <Link
            href='/dashboard/kanban'
            className='flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors shadow-xs group'
          >
            <div className='h-8 w-8 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0'>
              <Icons.kanban className='h-4 w-4' />
            </div>
            <div>
              <div className='text-xs font-medium text-foreground group-hover:text-primary transition-colors'>
                Kanban Board
              </div>
              <div className='text-[11px] text-muted-foreground'>Review active tasks</div>
            </div>
          </Link>
        </div>

        {/* Push Enablement Alert */}
        <EnablePushButton />

        {/* Notification Tabs and Filter */}
        <Tabs defaultValue='all'>
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
            <TabsList>
              <TabsTrigger value='all'>All ({filteredByType.length})</TabsTrigger>
              <TabsTrigger value='unread'>Unread ({unreadNotifications.length})</TabsTrigger>
              <TabsTrigger value='read'>Read ({readNotifications.length})</TabsTrigger>
              <TabsTrigger value='preferences'>Preferences & Devices</TabsTrigger>
            </TabsList>

            <div className='w-48'>
              <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val ?? 'all')}>
                <SelectTrigger className='h-8 text-xs'>
                  <SelectValue placeholder='Filter by type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All categories</SelectItem>
                  <SelectItem value='mail.received'>Role Mail</SelectItem>
                  <SelectItem value='event.invited'>Calendar Invites</SelectItem>
                  <SelectItem value='event.updated'>Event Updates</SelectItem>
                  <SelectItem value='task.assigned'>Task Assignments</SelectItem>
                  <SelectItem value='digest.ready'>Weekly Digest</SelectItem>
                  <SelectItem value='document.added'>Documents</SelectItem>
                  <SelectItem value='system'>System Alerts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value='all' className='mt-4'>
            {renderGroupedList(filteredByType)}
          </TabsContent>
          <TabsContent value='unread' className='mt-4'>
            {renderGroupedList(unreadNotifications)}
          </TabsContent>
          <TabsContent value='read' className='mt-4'>
            {renderGroupedList(readNotifications)}
          </TabsContent>
          <TabsContent value='preferences' className='mt-4'>
            <NotificationPrefsForm prefs={settings.prefs} devices={settings.devices} />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
