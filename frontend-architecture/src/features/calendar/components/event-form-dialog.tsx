'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import {
  createEventAction,
  getAudienceOptionsAction,
  updateEventAction,
  type EventFormInput
} from '../actions';
import { isoToWibInputValue, wibInputValueToISO } from '../lib/format';
import type { CalendarEvent } from '../types';

type AudienceKind = 'user' | 'role' | 'group';
type AudienceRow = { kind: AudienceKind; id: string; label: string };

type AudienceOptions = {
  users: { id: string; full_name: string | null }[];
  roles: { id: string; name: string }[];
  groups: { id: string; name: string }[];
};

const RECURRENCE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: 'FREQ=DAILY', label: 'Daily' },
  { value: 'FREQ=WEEKLY', label: 'Weekly' },
  { value: 'FREQ=MONTHLY', label: 'Monthly' }
];

function eventToAudienceRows(event: CalendarEvent | undefined, options: AudienceOptions): AudienceRow[] {
  if (!event?.audience) return [];
  return event.audience.flatMap((a): AudienceRow[] => {
    if (a.kind === 'user' && a.user_id) {
      const u = options.users.find((x) => x.id === a.user_id);
      return [{ kind: 'user', id: a.user_id, label: u?.full_name || a.user_id }];
    }
    if (a.kind === 'role' && a.role_id) {
      const r = options.roles.find((x) => x.id === a.role_id);
      return [{ kind: 'role', id: a.role_id, label: r?.name || a.role_id }];
    }
    if (a.kind === 'group' && a.group_id) {
      const g = options.groups.find((x) => x.id === a.group_id);
      return [{ kind: 'group', id: a.group_id, label: g?.name || a.group_id }];
    }
    return [];
  });
}

export function EventFormDialog({
  mode,
  event,
  open,
  onOpenChange
}: {
  mode: 'create' | 'edit';
  event?: CalendarEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<AudienceOptions>({ users: [], roles: [], groups: [] });
  const [audience, setAudience] = useState<AudienceRow[]>([]);
  const [pickKind, setPickKind] = useState<AudienceKind>('user');
  const [pickId, setPickId] = useState('');
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [recurrence, setRecurrence] = useState(event?.rrule ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void getAudienceOptionsAction().then((opts) => {
      setOptions(opts);
      setAudience(eventToAudienceRows(event, opts));
    });
    setAllDay(event?.all_day ?? false);
    setRecurrence(event?.rrule ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  const addAudience = () => {
    if (!pickId) return;
    if (audience.some((a) => a.kind === pickKind && a.id === pickId)) {
      setPickId('');
      return;
    }
    const list = pickKind === 'user' ? options.users : pickKind === 'role' ? options.roles : options.groups;
    const found = list.find((x) => x.id === pickId) as
      | { id: string; full_name?: string | null; name?: string }
      | undefined;
    const label = found ? (found.full_name ?? found.name ?? pickId) : pickId;
    setAudience((prev) => [...prev, { kind: pickKind, id: pickId, label }]);
    setPickId('');
  };

  const removeAudience = (kind: AudienceKind, id: string) => {
    setAudience((prev) => prev.filter((a) => !(a.kind === kind && a.id === id)));
  };

  const pickerList =
    pickKind === 'user'
      ? options.users.map((u) => ({ id: u.id, label: u.full_name || u.id }))
      : pickKind === 'role'
        ? options.roles.map((r) => ({ id: r.id, label: r.name }))
        : options.groups.map((g) => ({ id: g.id, label: g.name }));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    const formData = new FormData(form);

    const title = String(formData.get('title') || '').trim();
    if (!title) {
      setError('Please enter a title.');
      return;
    }

    const startRaw = String(formData.get('starts_at') || '');
    const endRaw = String(formData.get('ends_at') || '');
    if (!startRaw || !endRaw) {
      setError('Start and end are required.');
      return;
    }

    const starts_at = allDay
      ? wibInputValueToISO(`${startRaw}T00:00`)
      : wibInputValueToISO(startRaw);
    const ends_at = allDay ? wibInputValueToISO(`${endRaw}T23:59`) : wibInputValueToISO(endRaw);

    const input: EventFormInput = {
      title,
      description: String(formData.get('description') || '').trim() || null,
      location: String(formData.get('location') || '').trim() || null,
      starts_at,
      ends_at,
      all_day: allDay,
      rrule: recurrence || null,
      audience: audience.map((a) => ({
        user_id: a.kind === 'user' ? a.id : undefined,
        role_id: a.kind === 'role' ? a.id : undefined,
        group_id: a.kind === 'group' ? a.id : undefined
      }))
    };

    setLoading(true);
    setError(null);
    try {
      const res =
        mode === 'create'
          ? await createEventAction(input)
          : await updateEventAction(event!.id, input);
      if (!res.ok) {
        setError(res.error ?? 'Failed to save event');
        return;
      }
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const startDefault = event ? isoToWibInputValue(event.starts_at) : '';
  const endDefault = event ? isoToWibInputValue(event.ends_at) : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[520px]'>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New event' : 'Edit event'}</DialogTitle>
          <DialogDescription>Times are entered and shown in WIB (Asia/Jakarta).</DialogDescription>
        </DialogHeader>

        {error && (
          <div className='rounded-md bg-destructive/10 p-2 text-xs text-destructive'>{error}</div>
        )}

        <form id='event-form' className='grid gap-3 py-2' onSubmit={handleSubmit}>
          <div className='space-y-1'>
            <label htmlFor='title' className='text-sm font-medium'>
              Title
            </label>
            <Input id='title' name='title' required disabled={loading} defaultValue={event?.title} />
          </div>

          <div className='flex items-center gap-2'>
            <input
              id='all_day'
              type='checkbox'
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              disabled={loading}
              aria-label='All day'
              className='h-4 w-4 rounded border-input'
            />
            <label htmlFor='all_day' className='text-sm'>
              All day
            </label>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <label htmlFor='starts_at' className='text-sm font-medium'>
                Start (WIB)
              </label>
              <Input
                id='starts_at'
                name='starts_at'
                type={allDay ? 'date' : 'datetime-local'}
                required
                disabled={loading}
                defaultValue={allDay ? startDefault.slice(0, 10) : startDefault}
              />
            </div>
            <div className='space-y-1'>
              <label htmlFor='ends_at' className='text-sm font-medium'>
                End (WIB)
              </label>
              <Input
                id='ends_at'
                name='ends_at'
                type={allDay ? 'date' : 'datetime-local'}
                required
                disabled={loading}
                defaultValue={allDay ? endDefault.slice(0, 10) : endDefault}
              />
            </div>
          </div>

          <div className='space-y-1'>
            <label htmlFor='location' className='text-sm font-medium'>
              Location
            </label>
            <Input id='location' name='location' disabled={loading} defaultValue={event?.location ?? ''} />
          </div>

          <div className='space-y-1'>
            <label htmlFor='description' className='text-sm font-medium'>
              Description
            </label>
            <Textarea
              id='description'
              name='description'
              disabled={loading}
              defaultValue={event?.description ?? ''}
            />
          </div>

          <div className='space-y-1'>
            <label htmlFor='rrule' className='text-sm font-medium'>
              Repeats
            </label>
            <select
              id='rrule'
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              disabled={loading}
              className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className='space-y-2'>
            <span className='text-sm font-medium'>Audience</span>
            <div className='flex items-center gap-2'>
              <select
                value={pickKind}
                onChange={(e) => {
                  setPickKind(e.target.value as AudienceKind);
                  setPickId('');
                }}
                disabled={loading}
                className='h-9 rounded-md border border-input bg-transparent px-2 text-sm'
              >
                <option value='user'>User</option>
                <option value='role'>Role</option>
                <option value='group'>Group</option>
              </select>
              <select
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                disabled={loading}
                className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs'
              >
                <option value=''>Select {pickKind}…</option>
                {pickerList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <Button type='button' size='sm' variant='outline' onClick={addAudience} disabled={!pickId || loading}>
                Add
              </Button>
            </div>

            {audience.length === 0 ? (
              <p className='text-xs text-muted-foreground'>No audience yet — only you can see this event.</p>
            ) : (
              <div className='flex flex-wrap gap-1.5'>
                {audience.map((a) => (
                  <span
                    key={`${a.kind}-${a.id}`}
                    className='inline-flex items-center gap-1 rounded-full border border-input bg-muted/40 px-2 py-0.5 text-[11px]'
                  >
                    <span className='text-muted-foreground'>{a.kind}</span>
                    {a.label}
                    <button
                      type='button'
                      onClick={() => removeAudience(a.kind, a.id)}
                      disabled={loading}
                      className='ml-0.5 text-muted-foreground hover:text-destructive'
                      aria-label={`Remove ${a.label}`}
                    >
                      <Icons.close className='h-3 w-3' />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type='submit' form='event-form' disabled={loading}>
            {loading ? 'Saving…' : mode === 'create' ? 'Create event' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
