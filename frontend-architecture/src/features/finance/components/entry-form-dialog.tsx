'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import { useAppForm } from '@/lib/form';
import { createEntryAction, updateEntryAction } from '../actions';
import { entrySchema, type BoardOption, type FinanceCategory, type FinanceEntry } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boards: BoardOption[];
  categories: FinanceCategory[];
  /** Present when editing; absent when creating. */
  entry?: FinanceEntry | null;
  onSaved: () => void;
};

/** Create/edit an entry. A Dialog, matching every other form in this app (no Sheet form exists yet). */
export function EntryFormDialog({ open, onOpenChange, boards, categories, entry, onSaved }: Props) {
  const isEdit = Boolean(entry);

  const form = useAppForm({
    defaultValues: {
      boardId: entry?.board_id ?? '',
      categoryId: entry?.category_id ?? '',
      direction: (entry?.direction ?? 'outflow') as 'inflow' | 'outflow',
      amount: entry?.amount ?? '',
      description: entry?.description ?? '',
      occurredOn: entry ? new Date(`${entry.occurred_on}T00:00:00`) : new Date()
    },
    onSubmit: async ({ value }) => {
      const parsed = entrySchema.safeParse({
        boardId: value.boardId,
        categoryId: value.categoryId,
        direction: value.direction,
        amount: value.amount,
        description: value.description,
        occurredOn: format(value.occurredOn, 'yyyy-MM-dd')
      });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? 'Invalid entry');
        return;
      }

      const res = entry
        ? await updateEntryAction(entry.id, parsed.data)
        : await createEntryAction(parsed.data);

      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? 'Entry updated' : 'Entry recorded');
      onOpenChange(false);
      onSaved();
    }
  });

  // Reset to the right defaults each time the dialog opens for a (possibly different) entry.
  React.useEffect(() => {
    if (!open) return;
    form.reset({
      boardId: entry?.board_id ?? '',
      categoryId: entry?.category_id ?? '',
      direction: (entry?.direction ?? 'outflow') as 'inflow' | 'outflow',
      amount: entry?.amount ?? '',
      description: entry?.description ?? '',
      occurredOn: entry ? new Date(`${entry.occurred_on}T00:00:00`) : new Date()
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit entry' : 'Record income or spending'}</DialogTitle>
          <DialogDescription>Amounts are IDR only, dates are shown in WIB.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldGroup>
            <form.AppField
              name='direction'
              children={(field) => (
                <field.RadioGroupField
                  label='Direction'
                  required
                  options={[
                    { value: 'inflow', label: 'Inflow' },
                    { value: 'outflow', label: 'Outflow' }
                  ]}
                />
              )}
            />
            <form.AppField
              name='boardId'
              children={(field) => (
                <field.ComboboxField
                  label='Board'
                  required
                  placeholder='Pick a board'
                  options={boards.map((b) => ({ value: b.id, label: b.name }))}
                />
              )}
            />
            <form.AppField
              name='categoryId'
              children={(field) => (
                <field.ComboboxField
                  label='Category'
                  required
                  placeholder='Pick a category'
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
              )}
            />
            <form.AppField
              name='amount'
              children={(field) => (
                <field.TextField label='Amount (Rp)' required placeholder='250000' />
              )}
            />
            <form.AppField
              name='description'
              children={(field) => (
                <field.TextField label='Description' required placeholder='What was this for?' />
              )}
            />
            <form.AppField
              name='occurredOn'
              children={(field) => <field.DatePickerField label='Date' required />}
            />
          </FieldGroup>
          <DialogFooter className='mt-4'>
            <form.AppForm>
              <form.SubmitButton>{isEdit ? 'Save changes' : 'Record entry'}</form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
