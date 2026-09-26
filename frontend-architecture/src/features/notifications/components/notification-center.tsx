'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { NotificationCard } from '@/components/ui/notification-card';
import { useNotificationStore, type Notification } from '../utils/store';
import { useNotificationFeed } from '../hooks/use-notification-feed';
import { getNotificationsAction } from '../actions';
import { createClient } from '@/lib/supabase/client';

const MAX_VISIBLE = 5;

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, setNotifications } =
    useNotificationStore();
  const router = useRouter();
  const [userId, setUserId] = React.useState<string | null>(null);

  const fetchItems = React.useCallback(async () => {
    const res = await getNotificationsAction({ limit: 20 });
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
              label: 'View details',
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
  }, [fetchItems]);

  useNotificationFeed(userId, fetchItems);

  const visibleNotifications = notifications.slice(0, MAX_VISIBLE);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            className='relative h-8 w-8'
            aria-label='Open notifications'
          />
        }
      >
        <Icons.notification className='h-4 w-4' />
        {unreadCount > 0 && (
          <span className='bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium'>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span className='sr-only'>Notifications</span>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-[calc(100vw-2rem)] p-0 sm:w-[380px]' sideOffset={8}>
        <div className='flex items-center justify-between px-4 pt-3'>
          <Link href='/dashboard/notifications' className='group flex items-center gap-1'>
            <h4 className='group-hover:text-primary text-sm font-semibold transition-colors'>
              Notifications
            </h4>
            <Icons.chevronRight className='text-muted-foreground group-hover:text-primary h-3.5 w-3.5 transition-colors' />
          </Link>
          <div className='flex items-center gap-1'>
            {unreadCount > 0 && (
              <Button
                variant='ghost'
                size='xs'
                onClick={markAllAsRead}
                className='text-muted-foreground hover:text-foreground text-xs'
              >
                Mark all as read
              </Button>
            )}
          </div>
        </div>
        <Separator className='mt-3' />
        <ScrollArea className='h-[340px]'>
          {visibleNotifications.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-8 text-center'>
              <Icons.notification className='text-muted-foreground/40 mb-2 h-8 w-8' />
              <p className='text-muted-foreground text-xs'>No notifications yet</p>
            </div>
          ) : (
            <div className='flex flex-col gap-1 p-2'>
              {visibleNotifications.map((notification) => (
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
          )}
        </ScrollArea>
        {notifications.length > MAX_VISIBLE && (
          <>
            <Separator />
            <div className='p-2 text-center'>
              <Button
                variant='ghost'
                size='sm'
                className='w-full text-xs'
                onClick={() => router.push('/dashboard/notifications')}
              >
                View all {notifications.length} notifications
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
