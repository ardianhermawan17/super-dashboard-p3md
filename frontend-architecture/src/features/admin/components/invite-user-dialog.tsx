'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAppForm } from '@/lib/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { inviteUsersAction } from '../actions';
import type { GroupItem, RoleItem } from '../types';

const inviteSchema = z.object({
  email: z.string().email('Valid email is required'),
  fullName: z.string().optional()
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export function InviteUserDialog({
  roles,
  groups
}: {
  roles: RoleItem[];
  groups: GroupItem[];
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const router = useRouter();

  const form = useAppForm({
    defaultValues: {
      email: '',
      fullName: ''
    } as InviteFormValues,
    validators: {
      onSubmit: inviteSchema
    },
    onSubmit: async ({ value }) => {
      const res = await inviteUsersAction([
        {
          email: value.email,
          full_name: value.fullName,
          role_ids: selectedRoleIds,
          group_ids: selectedGroupIds
        }
      ]);

      if (!res.ok) {
        toast.error(res.error || 'Failed to send invite');
        return;
      }

      toast.success(`Invitation sent to ${value.email}`);
      setOpen(false);
      form.reset();
      setSelectedRoleIds([]);
      setSelectedGroupIds([]);
      router.refresh();
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button {...props} size='sm' className='gap-1.5'>
            <Icons.add className='h-4 w-4' />
            Invite User
          </Button>
        )}
      />
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Send an email invitation. The member will land with assigned groups and roles upon sign-in.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className='space-y-4'
        >
          <form.AppField
            name='email'
            children={(field) => (
              <field.TextField
                label='Email'
                type='email'
                placeholder='member@p3md.site'
                required
              />
            )}
          />

          <form.AppField
            name='fullName'
            children={(field) => (
              <field.TextField
                label='Full Name'
                placeholder='Alex Morgan'
              />
            )}
          />

          <div className='space-y-2'>
            <span className='block text-xs font-medium text-muted-foreground'>Direct Roles</span>
            <div className='flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-lg border border-input bg-muted/20'>
              {roles.map((role) => {
                const selected = selectedRoleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type='button'
                    onClick={() =>
                      setSelectedRoleIds((prev) =>
                        selected ? prev.filter((id) => id !== role.id) : [...prev, role.id]
                      )
                    }
                    className={`text-xs px-2 py-1 rounded-md transition-colors border ${
                      selected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    {role.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className='space-y-2'>
            <span className='block text-xs font-medium text-muted-foreground'>Initial Groups</span>
            <div className='flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-lg border border-input bg-muted/20'>
              {groups
                .filter((g) => g.slug !== 'all-members')
                .map((group) => {
                  const selected = selectedGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type='button'
                      onClick={() =>
                        setSelectedGroupIds((prev) =>
                          selected ? prev.filter((id) => id !== group.id) : [...prev, group.id]
                        )
                      }
                      className={`text-xs px-2 py-1 rounded-md transition-colors border ${
                        selected
                          ? 'bg-secondary text-secondary-foreground border-secondary'
                          : 'bg-background hover:bg-muted border-border text-foreground'
                      }`}
                    >
                      {group.name}
                    </button>
                  );
                })}
            </div>
          </div>

          <DialogFooter className='gap-2 sm:gap-0 mt-4'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <form.SubmitButton>
              Send Invite
            </form.SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
