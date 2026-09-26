'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Icons } from '@/components/icons';
import {
  deletePushSubscriptionAction,
  toggleNotificationPrefAction
} from '../actions';
import type { NotificationPref, NotificationType, PushSubscriptionDevice } from '../types';

const NOTIFICATION_TYPE_DEFINITIONS: {
  type: NotificationType;
  title: string;
  description: string;
}[] = [
  {
    type: 'mail.received',
    title: 'Role Mail Received',
    description: 'Notifications when mail is sent to your assigned roles or groups.'
  },
  {
    type: 'event.invited',
    title: 'Calendar Event Invitations',
    description: 'Alerts when your team or group is invited to a new agenda event.'
  },
  {
    type: 'event.updated',
    title: 'Calendar Event Updates',
    description: 'Changes to event schedules, locations, or notes.'
  },
  {
    type: 'task.assigned',
    title: 'Task Assignments',
    description: 'Notifications when a kanban card is assigned to you.'
  },
  {
    type: 'digest.ready',
    title: 'Weekly Digest',
    description: 'Weekly summaries of team progress and activity.'
  },
  {
    type: 'document.added',
    title: 'Document Additions',
    description: 'New resources and documents added to your group libraries.'
  },
  {
    type: 'system',
    title: 'System Announcements',
    description: 'Critical system maintenance and workspace alerts.'
  }
];

export function NotificationPrefsForm({
  prefs,
  devices
}: {
  prefs: NotificationPref[];
  devices: PushSubscriptionDevice[];
}) {
  const router = useRouter();
  const [prefState, setPrefState] = React.useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const def of NOTIFICATION_TYPE_DEFINITIONS) {
      const found = prefs.find((p) => p.type === def.type);
      map[def.type] = found ? found.push : true; // default true
    }
    return map;
  });
  const [pendingType, setPendingType] = React.useState<string | null>(null);
  const [deletingDeviceId, setDeletingDeviceId] = React.useState<string | null>(null);

  const handleToggle = async (type: string, enabled: boolean) => {
    setPendingType(type);
    setPrefState((prev) => ({ ...prev, [type]: enabled }));

    const res = await toggleNotificationPrefAction(type, enabled);
    if (!res.ok) {
      setPrefState((prev) => ({ ...prev, [type]: !enabled }));
      toast.error('Failed to update preference.');
    } else {
      toast.success('Notification preference updated.');
    }
    setPendingType(null);
  };

  const handleDeleteDevice = async (id: string) => {
    setDeletingDeviceId(id);
    const res = await deletePushSubscriptionAction(id);
    if (res.ok) {
      toast.success('Device removed.');
      router.refresh();
    } else {
      toast.error(res.error ?? 'Failed to remove device.');
    }
    setDeletingDeviceId(null);
  };

  return (
    <div className='space-y-6'>
      <div className='rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs space-y-4'>
        <h3 className='text-sm font-semibold text-foreground'>Notification Categories</h3>
        <p className='text-xs text-muted-foreground'>
          Choose which notifications trigger instant Web Push alerts on your registered devices.
        </p>

        <div className='divide-y divide-border/60'>
          {NOTIFICATION_TYPE_DEFINITIONS.map((def) => {
            const isEnabled = prefState[def.type] ?? true;
            const isPending = pendingType === def.type;

            return (
              <div
                key={def.type}
                className='flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-1'
              >
                <div className='space-y-0.5'>
                  <div className='text-xs font-medium text-foreground'>{def.title}</div>
                  <div className='text-[11px] text-muted-foreground'>{def.description}</div>
                </div>
                <div className='flex items-center gap-2'>
                  {isPending && <Icons.spinner className='h-3 w-3 animate-spin text-muted-foreground' />}
                  <Switch
                    checked={isEnabled}
                    disabled={isPending}
                    onCheckedChange={(checked) => handleToggle(def.type, checked)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className='rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs space-y-4'>
        <h3 className='text-sm font-semibold text-foreground'>Registered Push Devices</h3>
        <p className='text-xs text-muted-foreground'>
          Active browser sessions registered to receive Web Push notifications for your account.
        </p>

        {devices.length === 0 ? (
          <div className='text-xs text-muted-foreground py-4 text-center italic bg-muted/20 rounded-lg border border-dashed'>
            No devices currently registered for push notifications.
          </div>
        ) : (
          <div className='divide-y divide-border/60'>
            {devices.map((device) => {
              const isDeleting = deletingDeviceId === device.id;
              const cleanAgent = device.user_agent
                ? device.user_agent.split('(')[0].trim() || 'Browser'
                : 'Unknown device';

              return (
                <div
                  key={device.id}
                  className='flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-1'
                >
                  <div className='space-y-0.5'>
                    <div className='text-xs font-medium text-foreground flex items-center gap-1.5'>
                      <Icons.laptop className='h-3.5 w-3.5 text-muted-foreground' />
                      <span>{cleanAgent}</span>
                    </div>
                    <div className='text-[11px] text-muted-foreground'>
                      Registered: {new Date(device.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    disabled={isDeleting}
                    onClick={() => handleDeleteDevice(device.id)}
                    className='h-7 px-2 text-xs text-muted-foreground hover:text-destructive'
                  >
                    {isDeleting ? (
                      <Icons.spinner className='h-3 w-3 animate-spin' />
                    ) : (
                      <Icons.trash className='h-3.5 w-3.5' />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
