'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Icons } from '@/components/icons';
import {
  deleteGroupAction,
  saveGroupAction,
  updateGroupMembersAction,
  updateGroupRolesAction
} from '../actions';
import type { GroupDetail, RoleItem } from '../types';

export function GroupsView({
  initialGroups,
  allRoles,
  allUsers
}: {
  initialGroups: GroupDetail[];
  allRoles: RoleItem[];
  allUsers: { id: string; email: string; full_name: string | null }[];
}) {
  const router = useRouter();
  const [editingGroup, setEditingGroup] = React.useState<GroupDetail | null>(null);
  const [managingMembersGroup, setManagingMembersGroup] = React.useState<GroupDetail | null>(null);
  const [managingRolesGroup, setManagingRolesGroup] = React.useState<GroupDetail | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  // Group Form state
  const [slug, setSlug] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Member management state
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [pasteEmails, setPasteEmails] = React.useState('');

  // Role assignment state
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);

  const openCreate = () => {
    setSlug('');
    setName('');
    setDescription('');
    setEditingGroup(null);
    setIsCreating(true);
  };

  const openEdit = (g: GroupDetail) => {
    setSlug(g.slug);
    setName(g.name);
    setDescription(g.description || '');
    setEditingGroup(g);
    setIsCreating(true);
  };

  const handleSaveGroup = async () => {
    if (!slug.trim() || !name.trim()) {
      toast.error('Slug and name are required');
      return;
    }

    setIsSubmitting(true);
    const res = await saveGroupAction({
      id: editingGroup?.id,
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      description: description.trim() || undefined
    });
    setIsSubmitting(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to save group');
      return;
    }

    toast.success(`Group ${name} saved`);
    setIsCreating(false);
    router.refresh();
  };

  const handleDeleteGroup = async (g: GroupDetail) => {
    if (g.is_system) {
      toast.error('System groups cannot be deleted');
      return;
    }

    if (!confirm(`Are you sure you want to delete group "${g.name}"?`)) return;

    const res = await deleteGroupAction(g.id);
    if (!res.ok) {
      toast.error(res.error || 'Failed to delete group');
      return;
    }

    toast.success(`Group "${g.name}" deleted`);
    router.refresh();
  };

  const openMembersModal = (g: GroupDetail) => {
    setManagingMembersGroup(g);
    setSelectedUserIds(g.memberIds);
    setPasteEmails('');
  };

  const handleSaveMembers = async () => {
    if (!managingMembersGroup) return;

    let finalUserIds = [...selectedUserIds];

    if (pasteEmails.trim()) {
      const emailList = pasteEmails
        .split(/[\n,;]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0);

      const emailMap = new Map(allUsers.map((u) => [u.email.toLowerCase(), u.id]));
      for (const email of emailList) {
        const uid = emailMap.get(email);
        if (uid && !finalUserIds.includes(uid)) {
          finalUserIds.push(uid);
        }
      }
    }

    setIsSubmitting(true);
    const res = await updateGroupMembersAction(managingMembersGroup.id, finalUserIds);
    setIsSubmitting(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to update members');
      return;
    }

    toast.success(`Updated members for ${managingMembersGroup.name}`);
    setManagingMembersGroup(null);
    router.refresh();
  };

  const openRolesModal = (g: GroupDetail) => {
    setManagingRolesGroup(g);
    setSelectedRoleIds(g.roleIds);
  };

  const handleSaveRoles = async () => {
    if (!managingRolesGroup) return;

    setIsSubmitting(true);
    const res = await updateGroupRolesAction(managingRolesGroup.id, selectedRoleIds);
    setIsSubmitting(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to update group roles');
      return;
    }

    toast.success(`Updated roles granted by ${managingRolesGroup.name}`);
    setManagingRolesGroup(null);
    router.refresh();
  };

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>
          Groups allow organizing members and granting roles collectively.
        </p>
        <Button onClick={openCreate} size='sm' className='gap-1.5'>
          <Icons.add className='h-4 w-4' />
          Create Group
        </Button>
      </div>

      <div className='rounded-xl border border-border bg-card overflow-hidden shadow-xs'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Granted Roles</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialGroups.map((group) => {
              const rolesList = allRoles.filter((r) => group.roleIds.includes(r.id));
              return (
                <TableRow key={group.id}>
                  <TableCell>
                    <div className='font-medium text-foreground flex items-center gap-2'>
                      {group.name}
                      {group.is_system && (
                        <Badge variant='outline' className='text-[10px] px-1 py-0'>
                          System
                        </Badge>
                      )}
                    </div>
                    {group.description && (
                      <div className='text-xs text-muted-foreground'>{group.description}</div>
                    )}
                  </TableCell>
                  <TableCell className='font-mono text-xs text-muted-foreground'>
                    {group.slug}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant='outline'
                      size='sm'
                      className='h-7 text-xs gap-1'
                      onClick={() => openMembersModal(group)}
                    >
                      <Icons.teams className='h-3.5 w-3.5' />
                      {group.memberCount} members
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-1 max-w-sm'>
                      {rolesList.length === 0 ? (
                        <span className='text-xs text-muted-foreground'>No roles assigned</span>
                      ) : (
                        rolesList.map((r) => (
                          <Badge key={r.id} className='text-[10px] px-1.5 py-0'>
                            {r.name}
                          </Badge>
                        ))
                      )}
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-5 px-1 text-[10px] text-muted-foreground hover:text-foreground'
                        onClick={() => openRolesModal(group)}
                      >
                        <Icons.edit className='h-3 w-3 mr-0.5' />
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex items-center justify-end gap-1'>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-8 w-8 p-0'
                        onClick={() => openEdit(group)}
                        title='Edit group details'
                      >
                        <Icons.edit className='h-4 w-4' />
                      </Button>
                      {!group.is_system && (
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0 text-destructive hover:text-destructive'
                          onClick={() => handleDeleteGroup(group)}
                          title='Delete group'
                        >
                          <Icons.trash className='h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className='text-xs text-muted-foreground p-2 rounded-lg bg-muted/30 border border-muted'>
        <span className='font-medium'>Note:</span> Changes to group membership and roles apply immediately to database access. User JWT claims and visible menus update on the next token refresh.
      </div>

      {/* Create / Edit Group Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'Create New Group'}</DialogTitle>
            <DialogDescription>
              Define the group identifier, display name, and purpose.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            <div className='space-y-1.5'>
              <span className='block text-xs font-semibold text-muted-foreground uppercase'>
                Name *
              </span>
              <Input
                placeholder='Engineering Team'
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingGroup) {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }
                }}
              />
            </div>

            <div className='space-y-1.5'>
              <span className='block text-xs font-semibold text-muted-foreground uppercase'>
                Slug *
              </span>
              <Input
                placeholder='engineering-team'
                value={slug}
                disabled={Boolean(editingGroup?.is_system)}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>

            <div className='space-y-1.5'>
              <span className='block text-xs font-semibold text-muted-foreground uppercase'>
                Description
              </span>
              <Textarea
                placeholder='Core engineering and development staff'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className='gap-2 sm:gap-0'>
            <Button variant='outline' onClick={() => setIsCreating(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSaveGroup} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Modal */}
      <Dialog open={Boolean(managingMembersGroup)} onOpenChange={(open) => !open && setManagingMembersGroup(null)}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Manage Members: {managingMembersGroup?.name}</DialogTitle>
            <DialogDescription>
              Toggle members or paste a batch list of emails to add to this group.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            <div className='space-y-2'>
              <span className='block text-xs font-semibold text-muted-foreground uppercase'>
                Current Workspace Members
              </span>
              <div className='flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 rounded-lg border border-input bg-muted/20'>
                {allUsers.map((user) => {
                  const selected = selectedUserIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type='button'
                      onClick={() =>
                        setSelectedUserIds((prev) =>
                          selected ? prev.filter((id) => id !== user.id) : [...prev, user.id]
                        )
                      }
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors border text-left ${
                        selected
                          ? 'bg-secondary text-secondary-foreground border-secondary font-medium'
                          : 'bg-background hover:bg-muted border-border text-foreground'
                      }`}
                    >
                      {user.full_name || user.email}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className='space-y-1.5'>
              <span className='block text-xs font-semibold text-muted-foreground uppercase'>
                Paste List of Emails
              </span>
              <Textarea
                placeholder='alex@p3md.site, sam@p3md.site, taylor@p3md.site'
                value={pasteEmails}
                onChange={(e) => setPasteEmails(e.target.value)}
                rows={3}
                className='font-mono text-xs'
              />
              <p className='text-[11px] text-muted-foreground'>
                Comma, semicolon, or newline separated emails of existing users.
              </p>
            </div>
          </div>

          <DialogFooter className='gap-2 sm:gap-0'>
            <Button variant='outline' onClick={() => setManagingMembersGroup(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSaveMembers} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Members'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Roles Modal */}
      <Dialog open={Boolean(managingRolesGroup)} onOpenChange={(open) => !open && setManagingRolesGroup(null)}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Group Roles: {managingRolesGroup?.name}</DialogTitle>
            <DialogDescription>
              Select roles granted to all members of this group.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            <div className='space-y-2'>
              <span className='block text-xs font-semibold text-muted-foreground uppercase'>
                Available Roles
              </span>
              <div className='flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2 rounded-lg border border-input bg-muted/20'>
                {allRoles.map((role) => {
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
          </div>

          <DialogFooter className='gap-2 sm:gap-0'>
            <Button variant='outline' onClick={() => setManagingRolesGroup(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoles} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Group Roles'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
