'use client';

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
import { upsertCategoryAction } from '../actions';
import { categorySchema, type FinanceCategory } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: FinanceCategory | null;
  onSaved: () => void;
};

/** `finance.manage`-only: add or edit a category. Dialog, matching every other form here. */
export function CategoryDialog({ open, onOpenChange, category, onSaved }: Props) {
  const form = useAppForm({
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      direction: (category?.direction ?? undefined) as 'inflow' | 'outflow' | undefined,
      color: category?.color ?? ''
    },
    onSubmit: async ({ value }) => {
      const parsed = categorySchema.safeParse({ id: category?.id, ...value });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0]?.message ?? 'Invalid category');
        return;
      }
      const res = await upsertCategoryAction(parsed.data);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Category saved');
      onOpenChange(false);
      onSaved();
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>
            Leave direction blank for a category usable both ways.
          </DialogDescription>
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
              name='name'
              children={(field) => <field.TextField label='Name' required placeholder='Venue' />}
            />
            <form.AppField
              name='slug'
              children={(field) => <field.TextField label='Slug' required placeholder='venue' />}
            />
            <form.AppField
              name='direction'
              children={(field) => (
                <field.SelectField
                  label='Direction'
                  options={[
                    { value: 'inflow', label: 'Inflow only' },
                    { value: 'outflow', label: 'Outflow only' }
                  ]}
                />
              )}
            />
            <form.AppField name='color' children={(field) => <field.ColorField label='Color' />} />
          </FieldGroup>
          <DialogFooter className='mt-4'>
            <form.AppForm>
              <form.SubmitButton>Save category</form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
