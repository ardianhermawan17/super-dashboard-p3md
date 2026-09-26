'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { usePushSubscription } from '../hooks/use-push-subscription';

export function EnablePushButton({ className }: { className?: string }) {
  const { isSupported, isSubscribed, needsInstall, permission, isLoading, enable, unsubscribe } =
    usePushSubscription();

  if (!isSupported) {
    return (
      <div className='text-xs text-muted-foreground p-3 rounded-lg border bg-muted/20'>
        Push notifications are not supported by this browser.
      </div>
    );
  }

  if (needsInstall) {
    return (
      <div className='flex items-start gap-2.5 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-foreground'>
        <Icons.info className='h-4 w-4 text-blue-500 shrink-0 mt-0.5' />
        <div>
          <span className='font-semibold'>Install Required on iOS:</span> Tap <strong>Share</strong>{' '}
          → <strong>Add to Home Screen</strong>, then open P3MD from your home screen to enable push
          notifications.
        </div>
      </div>
    );
  }

  if (isSubscribed) {
    return (
      <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card ${className ?? ''}`}>
        <div className='flex items-center gap-2 text-xs font-medium text-foreground'>
          <Icons.check className='h-4 w-4 text-emerald-500' />
          <span>Push notifications active on this device</span>
        </div>
        <Button
          variant='outline'
          size='sm'
          disabled={isLoading}
          onClick={unsubscribe}
          className='text-xs text-muted-foreground hover:text-destructive'
        >
          {isLoading ? <Icons.spinner className='h-3.5 w-3.5 animate-spin' /> : 'Disable'}
        </Button>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className='flex items-start gap-2.5 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-xs text-destructive'>
        <Icons.alertCircle className='h-4 w-4 shrink-0 mt-0.5' />
        <div>
          <span className='font-semibold'>Notifications Blocked:</span> Please reset notification
          permissions in your browser settings to enable push updates.
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-lg border border-primary/20 bg-primary/5 ${className ?? ''}`}>
      <div className='space-y-0.5'>
        <div className='text-xs font-medium text-foreground'>Get Real-time Notifications</div>
        <div className='text-[11px] text-muted-foreground'>
          Receive instant alerts for role mails, calendar updates, and team assignments.
        </div>
      </div>
      <Button
        variant='default'
        size='sm'
        disabled={isLoading}
        onClick={enable}
        className='text-xs shrink-0'
      >
        {isLoading ? (
          <Icons.spinner className='h-3.5 w-3.5 animate-spin mr-1' />
        ) : (
          <Icons.notification className='h-3.5 w-3.5 mr-1' />
        )}
        Enable Notifications
      </Button>
    </div>
  );
}
