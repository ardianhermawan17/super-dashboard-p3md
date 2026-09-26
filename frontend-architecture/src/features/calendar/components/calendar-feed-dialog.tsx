'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import {
  getCalendarFeedTokenAction,
  rotateCalendarFeedTokenAction
} from '../actions';

export function CalendarFeedDialog() {
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const loadToken = async () => {
    setLoading(true);
    const res = await getCalendarFeedTokenAction();
    if (res.token) {
      setToken(res.token);
    }
    setLoading(false);
  };

  const handleRotate = async () => {
    if (
      !confirm(
        'Are you sure you want to reset your calendar link? Existing calendar subscriptions will stop syncing until updated.'
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await rotateCalendarFeedTokenAction();
    if (res.token) {
      setToken(res.token);
    }
    setLoading(false);
  };

  const feedUrl =
    typeof window !== 'undefined' && token
      ? `${window.location.origin}/api/calendar/feed/${token}`
      : token
      ? `/api/calendar/feed/${token}`
      : '';

  const handleCopy = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog onOpenChange={(open) => open && !token && void loadToken()}>
      <DialogTrigger
        render={
          <Button variant='outline' size='sm' className='text-xs gap-1.5'>
            <Icons.rss className='h-3.5 w-3.5' />
            <span>Subscribe (ICS)</span>
          </Button>
        }
      />
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Subscribe to Agenda Feed</DialogTitle>
          <DialogDescription>
            Subscribe to your P3MD calendar events in Apple Calendar, Google Calendar, or Outlook using this private ICS feed URL.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-2'>
            <label htmlFor='feed-url-input' className='text-xs font-medium text-foreground'>
              Private Feed URL
            </label>
            <div className='flex items-center gap-2'>
              <Input
                id='feed-url-input'
                readOnly
                value={loading ? 'Loading feed URL...' : feedUrl}
                className='text-xs font-mono select-all'
              />
              <Button
                type='button'
                size='sm'
                onClick={handleCopy}
                disabled={loading || !token}
                className='shrink-0'
              >
                {copied ? <Icons.check className='h-4 w-4' /> : <Icons.copy className='h-4 w-4' />}
              </Button>
            </div>
            <p className='text-[11px] text-muted-foreground'>
              Keep this link private. Anyone with this link can view your scheduled calendar events.
            </p>
          </div>

          <div className='pt-2 border-t flex items-center justify-between'>
            <div className='text-[11px] text-muted-foreground'>
              Need to invalidate this link?
            </div>
            <Button
              type='button'
              variant='destructive'
              size='sm'
              className='text-xs'
              onClick={handleRotate}
              disabled={loading}
            >
              Reset Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
