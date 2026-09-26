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
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from '@/components/icons';
import { inviteUsersAction } from '../actions';
import type { GroupItem, InvitePayload, RoleItem } from '../types';

export function CsvImportDialog({
  roles,
  groups
}: {
  roles: RoleItem[];
  groups: GroupItem[];
}) {
  const [open, setOpen] = React.useState(false);
  const [csvText, setCsvText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const router = useRouter();

  const roleSlugMap = React.useMemo(() => new Map(roles.map((r) => [r.slug.toLowerCase(), r.id])), [roles]);
  const groupSlugMap = React.useMemo(() => new Map(groups.map((g) => [g.slug.toLowerCase(), g.id])), [groups]);

  const handleImport = async () => {
    const lines = csvText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('email'));

    if (lines.length === 0) {
      toast.error('Please provide at least one valid CSV line');
      return;
    }

    const invites: InvitePayload[] = [];
    for (const line of lines) {
      const parts = line.split(',').map((p) => p.trim());
      const email = parts[0];
      const fullName = parts[1] || undefined;
      const roleSlugs = parts[2] ? parts[2].split(';').map((s) => s.trim().toLowerCase()) : [];
      const groupSlugs = parts[3] ? parts[3].split(';').map((s) => s.trim().toLowerCase()) : [];

      if (!email || !email.includes('@')) {
        toast.error(`Invalid email format in row: ${line}`);
        return;
      }

      const role_ids = roleSlugs.map((s) => roleSlugMap.get(s)).filter(Boolean) as string[];
      const group_ids = groupSlugs.map((s) => groupSlugMap.get(s)).filter(Boolean) as string[];

      invites.push({
        email,
        full_name: fullName,
        role_ids,
        group_ids
      });
    }

    setIsSubmitting(true);
    const res = await inviteUsersAction(invites);
    setIsSubmitting(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to process CSV import');
      return;
    }

    toast.success(`Successfully queued ${res.invited ?? invites.length} invitations`);
    setOpen(false);
    setCsvText('');
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button {...props} variant='outline' size='sm' className='gap-1.5'>
            <Icons.upload className='h-4 w-4' />
            Import CSV
          </Button>
        )}
      />
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Import Users via CSV</DialogTitle>
          <DialogDescription>
            Paste CSV rows with format: <code className='text-xs bg-muted px-1 py-0.5 rounded'>email,full_name,roles,groups</code>.
            Roles and groups can be semicolon-separated slugs.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3 py-2'>
          <Textarea
            placeholder={`alex@p3md.site,Alex Morgan,admin;projectmanager,engineering\nsam@p3md.site,Sam Rivera,,finance`}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={8}
            className='font-mono text-xs'
          />
        </div>

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button variant='outline' onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isSubmitting || !csvText.trim()}>
            {isSubmitting ? 'Importing...' : 'Start Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
