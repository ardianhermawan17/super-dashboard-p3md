'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { OAuthClientInfo } from '../types';

interface RevokeAppDialogProps {
  client: OAuthClientInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (client: OAuthClientInfo) => Promise<void>;
  loading?: boolean;
}

export function RevokeAppDialog({
  client,
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: RevokeAppDialogProps) {
  if (!client) return null;

  const handleRevoke = async () => {
    await onConfirm(client);
  };

  const initial = client.name ? client.name.charAt(0).toUpperCase() : 'A';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <div className='flex items-center gap-3 mb-2'>
            <Avatar className='h-9 w-9 rounded-lg'>
              {client.logo_uri ? (
                <AvatarImage src={client.logo_uri} alt={`${client.name} logo`} />
              ) : null}
              <AvatarFallback className='rounded-lg text-sm font-semibold'>
                {initial}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className='text-lg'>Revoke access for {client.name}?</DialogTitle>
              <DialogDescription className='text-xs'>
                This action is immediate and invalidates all active tokens.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className='space-y-2 py-2 text-sm text-muted-foreground'>
          <p>
            Revoking access will immediately disconnect{' '}
            <span className='font-medium text-foreground'>{client.name}</span> from your P3MD
            account and invalidate its refresh tokens.
          </p>
          <p className='text-xs'>
            Any external agent or MCP client using this authorization will receive a 401 Unauthorized
            status on its next request until you authorize it again.
          </p>
        </div>

        <DialogFooter className='gap-2 sm:gap-0 pt-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type='button'
            variant='destructive'
            onClick={handleRevoke}
            disabled={loading}
          >
            {loading ? 'Revoking...' : 'Revoke Access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
