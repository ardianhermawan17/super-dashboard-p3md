'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { saveGoogleCalendarAction } from '../actions';
import type { GoogleCalendarItem, GroupItem, RoleItem } from '../types';

interface CalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendar: GoogleCalendarItem | null;
  allRoles: RoleItem[];
  allGroups: GroupItem[];
  onSaved: () => void;
}

export function CalendarDialog({
  open,
  onOpenChange,
  calendar,
  allRoles,
  allGroups,
  onSaved
}: CalendarDialogProps) {
  const [name, setName] = React.useState('');
  const [calendarId, setCalendarId] = React.useState('');
  const [direction, setDirection] = React.useState<'pull' | 'push' | 'both'>('pull');
  const [targetType, setTargetType] = React.useState<'role' | 'group'>('role');
  const [targetId, setTargetId] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (calendar) {
      setName(calendar.name);
      setCalendarId(calendar.calendar_id);
      setDirection(calendar.direction);
      if (calendar.role_id) {
        setTargetType('role');
        setTargetId(calendar.role_id);
      } else if (calendar.group_id) {
        setTargetType('group');
        setTargetId(calendar.group_id);
      } else {
        setTargetType('role');
        setTargetId('');
      }
      setEnabled(calendar.enabled);
    } else {
      setName('');
      setCalendarId('');
      setDirection('pull');
      setTargetType('role');
      setTargetId('');
      setEnabled(true);
    }
    setError(null);
  }, [calendar, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await saveGoogleCalendarAction({
        id: calendar?.id,
        calendar_id: calendarId,
        name,
        direction,
        target_type: targetType,
        target_id: targetId,
        enabled
      });

      if (!result.ok) {
        setError(result.error ?? 'Failed to save calendar link');
        return;
      }

      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const targets = targetType === 'role' ? allRoles : allGroups;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[520px]'>
        <DialogHeader>
          <DialogTitle>{calendar ? 'Edit Calendar Link' : 'Link Google Calendar'}</DialogTitle>
          <DialogDescription>
            Link a Google Calendar to an app audience. Pull imports Google events; push exports app events; both sync in each direction.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 py-2'>
          {error && (
            <div className='rounded-md bg-destructive/10 p-2.5 text-xs text-destructive'>
              {error}
            </div>
          )}

          <div className='space-y-1.5'>
            <label htmlFor='cal-name' className='text-xs font-semibold text-foreground'>
              Display Name <span className='text-destructive'>*</span>
            </label>
            <Input
              id='cal-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. P3MD Social — Event Agenda'
              disabled={loading}
              required
            />
          </div>

          <div className='space-y-1.5'>
            <label htmlFor='cal-id' className='text-xs font-semibold text-foreground'>
              Google Calendar ID <span className='text-destructive'>*</span>
            </label>
            <Input
              id='cal-id'
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              placeholder='abc123@group.calendar.google.com'
              disabled={loading}
              required
            />
            <p className='text-[11px] text-muted-foreground'>
              Found in Google Calendar → Settings and sharing. Share this calendar with the Service Account.
            </p>
          </div>

          <div className='space-y-1.5'>
            <label htmlFor='cal-direction' className='text-xs font-semibold text-foreground'>
              Sync Direction <span className='text-destructive'>*</span>
            </label>
            <select
              id='cal-direction'
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'pull' | 'push' | 'both')}
              disabled={loading}
              className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
            >
              <option value='pull'>Pull — import Google events into the app</option>
              <option value='push'>Push — export app events to Google</option>
              <option value='both'>Both — bi-directional sync</option>
            </select>
          </div>

          <div className='space-y-2 border-t pt-3'>
            <div className='text-xs font-semibold text-foreground'>Sync Audience</div>
            <p className='text-[11px] text-muted-foreground'>
              Bind this calendar to exactly one role or one group.
            </p>

            <div className='flex gap-2'>
              <Button
                type='button'
                size='sm'
                variant={targetType === 'role' ? 'default' : 'outline'}
                onClick={() => {
                  setTargetType('role');
                  setTargetId('');
                }}
                disabled={loading}
                className='h-7 px-2.5 text-xs'
              >
                Role
              </Button>
              <Button
                type='button'
                size='sm'
                variant={targetType === 'group' ? 'default' : 'outline'}
                onClick={() => {
                  setTargetType('group');
                  setTargetId('');
                }}
                disabled={loading}
                className='h-7 px-2.5 text-xs'
              >
                Group
              </Button>
            </div>

            <div className='flex flex-wrap gap-1.5'>
              {targets.length === 0 && (
                <span className='text-[11px] text-muted-foreground italic'>
                  No {targetType}s available
                </span>
              )}
              {targets.map((t) => (
                <button
                  key={t.id}
                  type='button'
                  onClick={() => setTargetId(t.id)}
                  className='focus:outline-none'
                  disabled={loading}
                  aria-label={`Select ${t.name}`}
                >
                  <Badge
                    variant={targetId === t.id ? 'default' : 'outline'}
                    className='cursor-pointer text-[11px]'
                  >
                    {t.name}
                  </Badge>
                </button>
              ))}
            </div>

            {!targetId && (
              <p className='text-[11px] text-destructive'>
                Select one {targetType} to bind this calendar to.
              </p>
            )}
          </div>

          <div className='flex items-center gap-2 pt-1'>
            <input
              type='checkbox'
              id='cal-enabled'
              aria-label='Enable this calendar link'
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={loading}
              className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
            />
            <label htmlFor='cal-enabled' className='text-xs font-medium text-foreground cursor-pointer'>
              Enable scheduled sync for this calendar
            </label>
          </div>

          <DialogFooter className='pt-3'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={loading || !targetId}>
              {loading ? 'Saving...' : calendar ? 'Save Changes' : 'Link Calendar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
