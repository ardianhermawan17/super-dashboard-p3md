'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateUserMembershipsAction } from '../actions';
import type { AdminUserRow, GroupItem, RoleItem } from '../types';

export function EditUserDialog({
  user,
  roles,
  groups,
  open,
  onOpenChange
}: {
  user: AdminUserRow | null;
  roles: RoleItem[];
  groups: GroupItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    if (user) {
      setSelectedRoleIds(user.directRoles.map((r) => r.id));
      setSelectedGroupIds(user.groups.map((g) => g.id));
    }
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    const res = await updateUserMembershipsAction(user.id, selectedRoleIds, selectedGroupIds);
    setIsSubmitting(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to update memberships');
      return;
    }

    toast.success(`Updated roles and groups for ${user.full_name || user.email}`);
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Edit Roles & Groups</DialogTitle>
          <DialogDescription>
            Modify direct roles and groups for <span className='font-semibold text-foreground'>{user.full_name || user.email}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-2'>
            <span className='block text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
              Direct Roles
            </span>
            <div className='flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-lg border border-input bg-muted/20'>
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
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors border ${
                      selected
                        ? 'bg-primary text-primary-foreground border-primary font-medium'
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
            <span className='block text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
              Groups
            </span>
            <div className='flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-lg border border-input bg-muted/20'>
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
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors border ${
                        selected
                          ? 'bg-secondary text-secondary-foreground border-secondary font-medium'
                          : 'bg-background hover:bg-muted border-border text-foreground'
                      }`}
                    >
                      {group.name}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
