'use client';

import * as React from 'react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

/**
 * PSI-123: the event form used a bare `<input type="datetime-local">`. Inside the modal
 * dialog its native popup closed as soon as the dialog took focus back, so a date could
 * not be chosen. This is the app-controlled equivalent (Popover + Calendar + a time
 * input): the popup opens on click and stays open until a date is chosen.
 *
 * The value stays a WIB wall-clock string ("YYYY-MM-DDTHH:mm", or "YYYY-MM-DD" for an
 * all-day event) so `wibInputValueToISO` in ../lib/format.ts keeps its contract. No
 * timezone maths happens here — the Calendar works on local calendar days.
 */

/** "YYYY-MM-DDTHH:mm" -> the wall-clock day plus its "HH:mm" part. */
function parseWibValue(value: string): { date: Date | undefined; time: string } {
  if (!value) return { date: undefined, time: '' };
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const date = year && month && day ? new Date(year, month - 1, day) : undefined;
  return { date, time: value.length >= 16 ? value.slice(11, 16) : '' };
}

function toYmd(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function DateTimePicker({
  id,
  name,
  label,
  required,
  disabled,
  allDay,
  defaultValue = '',
  defaultTime = '09:00'
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  allDay: boolean;
  /** WIB wall-clock value, "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD". */
  defaultValue?: string;
  defaultTime?: string;
}) {
  const initial = parseWibValue(defaultValue);
  const [date, setDate] = React.useState<Date | undefined>(initial.date);
  const [time, setTime] = React.useState(initial.time || defaultTime);
  const [open, setOpen] = React.useState(false);

  const value = date ? (allDay ? toYmd(date) : `${toYmd(date)}T${time || defaultTime}`) : '';

  return (
    <div className='space-y-1'>
      <label htmlFor={id} className='text-sm font-medium'>
        {label}
      </label>
      {/* Carries the value into FormData, exactly like the input it replaced. */}
      <input type='hidden' name={name} value={value} required={required} readOnly />
      <div className='flex gap-2'>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                id={id}
                type='button'
                variant='outline'
                disabled={disabled}
                aria-required={required}
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !date && 'text-muted-foreground'
                )}
              />
            }
          >
            <Icons.calendar className='mr-2 h-4 w-4' />
            {date ? format(date, 'PPP') : <span>Pick a date</span>}
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' align='start'>
            <Calendar
              mode='single'
              selected={date}
              autoFocus
              onSelect={(picked) => {
                setDate(picked);
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {!allDay && (
          <Input
            type='time'
            aria-label={`${label} time`}
            value={time}
            disabled={disabled}
            onChange={(e) => setTime(e.target.value)}
            className='w-28'
          />
        )}
      </div>
    </div>
  );
}
