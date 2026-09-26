'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  getBoardSharingAction,
  addBoardMemberAction,
  removeBoardMemberAction,
  addBoardGroupAction,
  removeBoardGroupAction
} from '../actions';
import { kanbanKeys } from '../api/keys';

interface BoardShareDialogProps {
  boardId: string;
}

export function BoardShareDialog({ boardId }: BoardShareDialogProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const queryKey = kanbanKeys.boardSharing(boardId);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await getBoardSharingAction(boardId);
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    enabled: open
  });

  const sharingData = data;
  const isOwner = sharingData?.isOwner ?? false;

  const currentMemberIds = new Set(sharingData?.members.map((m) => m.user_id) ?? []);
  const availableUsers = (sharingData?.allProfiles ?? []).filter(
    (u) => !currentMemberIds.has(u.id)
  );

  const currentGroupIds = new Set(sharingData?.groups.map((g) => g.group_id) ?? []);
  const availableGroups = (sharingData?.allGroups ?? []).filter(
    (g) => !currentGroupIds.has(g.id)
  );

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    setActionError(null);
    setSubmitting(true);
    try {
      const res = await addBoardMemberAction(boardId, selectedUserId);
      if (res.ok) {
        setSelectedUserId('');
        await qc.invalidateQueries({ queryKey });
      } else {
        setActionError(res.error ?? 'Failed to add member');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setActionError(null);
    setSubmitting(true);
    try {
      const res = await removeBoardMemberAction(boardId, userId);
      if (res.ok) {
        await qc.invalidateQueries({ queryKey });
      } else {
        setActionError(res.error ?? 'Failed to remove member');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddGroup = async () => {
    if (!selectedGroupId) return;
    setActionError(null);
    setSubmitting(true);
    try {
      const res = await addBoardGroupAction(boardId, selectedGroupId);
      if (res.ok) {
        setSelectedGroupId('');
        await qc.invalidateQueries({ queryKey });
      } else {
        setActionError(res.error ?? 'Failed to add group');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveGroup = async (groupId: string) => {
    setActionError(null);
    setSubmitting(true);
    try {
      const res = await removeBoardGroupAction(boardId, groupId);
      if (res.ok) {
        await qc.invalidateQueries({ queryKey });
      } else {
        setActionError(res.error ?? 'Failed to remove group');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant='outline' size='sm' />}>
        <Icons.users className='mr-2 h-4 w-4' />
        Share
      </DialogTrigger>
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>Share Board</DialogTitle>
          <DialogDescription>
            Manage individual members and group access for this board.
          </DialogDescription>
        </DialogHeader>

        {actionError && (
          <div className='rounded-md bg-destructive/10 p-2 text-xs text-destructive'>
            {actionError}
          </div>
        )}

        {isLoading ? (
          <div className='py-6 text-center text-xs text-muted-foreground'>
            Loading sharing details...
          </div>
        ) : (
          <Tabs defaultValue='members' className='w-full'>
            <TabsList className='grid w-full grid-cols-2'>
              <TabsTrigger value='members'>
                Users ({sharingData?.members.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value='groups'>
                Groups ({sharingData?.groups.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value='members' className='space-y-4 pt-3'>
              {isOwner && availableUsers.length > 0 && (
                <div className='flex items-center gap-2'>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    disabled={submitting}
                    className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                  >
                    <option value=''>Select user to add...</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name || user.id}
                      </option>
                    ))}
                  </select>
                  <Button
                    size='sm'
                    onClick={handleAddMember}
                    disabled={!selectedUserId || submitting}
                  >
                    Add
                  </Button>
                </div>
              )}

              <div className='max-h-[220px] space-y-2 overflow-y-auto pr-1'>
                {(sharingData?.members ?? []).length === 0 ? (
                  <p className='py-4 text-center text-xs text-muted-foreground'>
                    No individual members added.
                  </p>
                ) : (
                  sharingData?.members.map((member) => (
                    <div
                      key={member.user_id}
                      className='flex items-center justify-between rounded-md border p-2 text-sm'
                    >
                      <div className='flex items-center gap-2'>
                        <div className='size-2 rounded-full bg-primary/30' />
                        <span className='font-medium text-xs'>
                          {member.full_name || member.user_id}
                        </span>
                      </div>
                      {isOwner && (
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-7 px-2 text-xs text-destructive hover:bg-destructive/10'
                          onClick={() => handleRemoveMember(member.user_id)}
                          disabled={submitting}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value='groups' className='space-y-4 pt-3'>
              {isOwner && availableGroups.length > 0 && (
                <div className='flex items-center gap-2'>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    disabled={submitting}
                    className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                  >
                    <option value=''>Select group to share with...</option>
                    {availableGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.slug})
                      </option>
                    ))}
                  </select>
                  <Button
                    size='sm'
                    onClick={handleAddGroup}
                    disabled={!selectedGroupId || submitting}
                  >
                    Share
                  </Button>
                </div>
              )}

              <div className='max-h-[220px] space-y-2 overflow-y-auto pr-1'>
                {(sharingData?.groups ?? []).length === 0 ? (
                  <p className='py-4 text-center text-xs text-muted-foreground'>
                    No groups shared yet.
                  </p>
                ) : (
                  sharingData?.groups.map((group) => (
                    <div
                      key={group.group_id}
                      className='flex items-center justify-between rounded-md border p-2 text-sm'
                    >
                      <div className='flex items-center gap-2'>
                        <Icons.teams className='h-4 w-4 text-muted-foreground' />
                        <span className='font-medium text-xs'>
                          {group.name}
                        </span>
                        <span className='text-[10px] text-muted-foreground'>
                          ({group.slug})
                        </span>
                      </div>
                      {isOwner && (
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-7 px-2 text-xs text-destructive hover:bg-destructive/10'
                          onClick={() => handleRemoveGroup(group.group_id)}
                          disabled={submitting}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>

              <p className='text-[11px] text-muted-foreground'>
                Members of shared groups automatically inherit access to view and interact with this board.
              </p>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
