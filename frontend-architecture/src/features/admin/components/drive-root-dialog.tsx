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
import { saveDriveRootAction } from '../actions';
import type { DriveRootItem, GroupItem, RoleItem } from '../types';

interface DriveRootDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  root: DriveRootItem | null;
  allRoles: RoleItem[];
  allGroups: GroupItem[];
  onSaved: () => void;
}

export function DriveRootDialog({
  open,
  onOpenChange,
  root,
  allRoles,
  allGroups,
  onSaved
}: DriveRootDialogProps) {
  const [name, setName] = React.useState('');
  const [folderId, setFolderId] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (root) {
      setName(root.name);
      setFolderId(root.folder_id);
      setEnabled(root.enabled);
      setSelectedRoleIds(root.accessRoles.map((r) => r.id));
      setSelectedGroupIds(root.accessGroups.map((g) => g.id));
    } else {
      setName('');
      setFolderId('');
      setEnabled(true);
      setSelectedRoleIds([]);
      setSelectedGroupIds([]);
    }
    setError(null);
  }, [root, open]);

  const toggleRole = (id: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await saveDriveRootAction({
        id: root?.id,
        folder_id: folderId,
        name,
        enabled,
        role_ids: selectedRoleIds,
        group_ids: selectedGroupIds
      });

      if (!result.ok) {
        setError(result.error ?? 'Failed to save Drive root');
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[520px]'>
        <DialogHeader>
          <DialogTitle>{root ? 'Edit Drive Root' : 'Add Google Drive Root'}</DialogTitle>
          <DialogDescription>
            Configure a Google Drive folder shared with the Service Account. Access will be granted to the selected roles and groups.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4 py-2'>
          {error && (
            <div className='rounded-md bg-destructive/10 p-2.5 text-xs text-destructive'>
              {error}
            </div>
          )}

          <div className='space-y-1.5'>
            <label htmlFor='drive-root-name' className='text-xs font-semibold text-foreground'>
              Root Name <span className='text-destructive'>*</span>
            </label>
            <Input
              id='drive-root-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. Executive Board Documents, Finance Q3'
              disabled={loading}
              required
            />
          </div>

          <div className='space-y-1.5'>
            <label htmlFor='drive-root-folder' className='text-xs font-semibold text-foreground'>
              Folder URL or ID <span className='text-destructive'>*</span>
            </label>
            <Input
              id='drive-root-folder'
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder='https://drive.google.com/drive/folders/1abc... or 1abc...'
              disabled={loading}
              required
            />
            <p className='text-[11px] text-muted-foreground'>
              Paste the full Drive URL or folder ID. Make sure this folder is shared with the Service Account.
            </p>
          </div>

          <div className='flex items-center gap-2 pt-1'>
            <input
              type='checkbox'
              id='drive-root-enabled'
              aria-label='Enable this Drive root'
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={loading}
              className='h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary'
            />
            <label htmlFor='drive-root-enabled' className='text-xs font-medium text-foreground cursor-pointer'>
              Enable automatic sync for this root
            </label>
          </div>

          <div className='space-y-2 border-t pt-3'>
            <div className='text-xs font-semibold text-foreground'>Audience Access</div>
            <p className='text-[11px] text-muted-foreground'>
              Choose which roles and groups can view documents mirrored from this root.
            </p>

            <div className='space-y-2'>
              <div className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>Roles</div>
              <div className='flex flex-wrap gap-1.5'>
                {allRoles.length === 0 && <span className='text-[11px] text-muted-foreground italic'>No roles available</span>}
                {allRoles.map((r) => (
                  <button
                    key={r.id}
                    type='button'
                    onClick={() => toggleRole(r.id)}
                    className='focus:outline-none'
                    disabled={loading}
                  >
                    <Badge
                      variant={selectedRoleIds.includes(r.id) ? 'default' : 'outline'}
                      className='cursor-pointer text-[11px]'
                    >
                      {r.name}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className='space-y-2'>
              <div className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>Groups</div>
              <div className='flex flex-wrap gap-1.5'>
                {allGroups.length === 0 && <span className='text-[11px] text-muted-foreground italic'>No groups available</span>}
                {allGroups.map((g) => (
                  <button
                    key={g.id}
                    type='button'
                    onClick={() => toggleGroup(g.id)}
                    className='focus:outline-none'
                    disabled={loading}
                  >
                    <Badge
                      variant={selectedGroupIds.includes(g.id) ? 'default' : 'outline'}
                      className='cursor-pointer text-[11px]'
                    >
                      {g.name}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {selectedRoleIds.length === 0 && selectedGroupIds.length === 0 && (
              <p className='text-[11px] text-destructive'>
                At least one role or group must be selected, otherwise no one can see this root.
              </p>
            )}
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
            <Button type='submit' disabled={loading}>
              {loading ? 'Saving...' : root ? 'Save Changes' : 'Add Root'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
