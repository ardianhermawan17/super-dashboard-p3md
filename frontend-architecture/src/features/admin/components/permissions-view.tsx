'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/icons';
import type { PermissionCatalogueItem } from '../types';

export function PermissionsView({
  permissions
}: {
  permissions: PermissionCatalogueItem[];
}) {
  const [search, setSearch] = React.useState('');

  const filteredPermissions = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return permissions;
    return permissions.filter(
      (p) =>
        p.key.toLowerCase().includes(q) ||
        p.module.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [permissions, search]);

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <div className='relative w-full sm:w-72'>
          <Icons.search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search permissions...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-8'
          />
        </div>
        <div className='text-xs text-muted-foreground'>
          {filteredPermissions.length} of {permissions.length} permissions
        </div>
      </div>

      <div className='rounded-xl border border-border bg-card overflow-hidden shadow-xs'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Permission Key</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Granting Roles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPermissions.map((perm) => (
              <TableRow key={perm.key}>
                <TableCell className='font-mono text-xs font-semibold text-foreground'>
                  {perm.key}
                </TableCell>
                <TableCell>
                  <Badge variant='outline' className='text-xs uppercase tracking-wider font-mono'>
                    {perm.module}
                  </Badge>
                </TableCell>
                <TableCell className='text-xs text-muted-foreground max-w-md'>
                  {perm.description}
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-1 max-w-xs'>
                    {perm.grantingRoles.length === 0 ? (
                      <span className='text-xs text-muted-foreground italic'>None</span>
                    ) : (
                      perm.grantingRoles.map((r) => (
                        <Badge key={r.id} variant='secondary' className='text-[10px] px-1.5 py-0'>
                          {r.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className='text-xs text-muted-foreground p-2 rounded-lg bg-muted/30 border border-muted'>
        <span className='font-medium'>Note:</span> System permissions are defined by database migrations and cannot be deleted. Roles grant access to these permissions.
      </div>
    </div>
  );
}
