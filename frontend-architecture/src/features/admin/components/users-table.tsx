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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Icons } from '@/components/icons';
import { toggleUserSuspensionAction } from '../actions';
import { EditUserDialog } from './edit-user-dialog';
import { InviteUserDialog } from './invite-user-dialog';
import { CsvImportDialog } from './csv-import-dialog';
import type { AdminUserRow, GroupItem, RoleItem } from '../types';

export function UsersTable({
  initialUsers,
  roles,
  groups
}: {
  initialUsers: AdminUserRow[];
  roles: RoleItem[];
  groups: GroupItem[];
}) {
  const [search, setSearch] = React.useState('');
  const [editingUser, setEditingUser] = React.useState<AdminUserRow | null>(null);
  const router = useRouter();

  const filteredUsers = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialUsers;
    return initialUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q))
    );
  }, [initialUsers, search]);

  const handleToggleSuspension = async (user: AdminUserRow) => {
    const isSuspended = user.status === 'suspended';
    const action = isSuspended ? 'reactivate' : 'suspend';
    const res = await toggleUserSuspensionAction(user.id, action);

    if (!res.ok) {
      toast.error(res.error || `Failed to ${action} user`);
      return;
    }

    toast.success(`User ${user.email} ${action}d successfully`);
    router.refresh();
  };

  return (
    <div className='space-y-4'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
        <div className='relative w-full sm:w-72'>
          <Icons.search className='absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Search users by name or email...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-8'
          />
        </div>
        <div className='flex items-center gap-2 w-full sm:w-auto'>
          <CsvImportDialog roles={roles} groups={groups} />
          <InviteUserDialog roles={roles} groups={groups} />
        </div>
      </div>

      <div className='rounded-xl border border-border bg-card overflow-hidden shadow-xs'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead className='w-[60px]'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center text-muted-foreground'>
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => {
                const isSuspended = user.status === 'suspended';
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className='font-medium text-foreground'>
                        {user.full_name || 'Unnamed Member'}
                      </div>
                      <div className='text-xs text-muted-foreground'>{user.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isSuspended ? 'destructive' : 'secondary'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1 max-w-xs'>
                        {user.groups.length === 0 ? (
                          <span className='text-xs text-muted-foreground'>None</span>
                        ) : (
                          user.groups.map((g) => (
                            <Badge key={g.id} variant='outline' className='text-[10px] px-1.5 py-0'>
                              {g.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap gap-1 max-w-sm'>
                        {user.directRoles.map((r) => (
                          <Badge key={r.id} className='text-[10px] px-1.5 py-0'>
                            {r.name}
                          </Badge>
                        ))}
                        {user.inheritedRoles.map((ir) => (
                          <Badge
                            key={`${ir.id}-${ir.viaGroup}`}
                            variant='outline'
                            className='text-[10px] px-1.5 py-0 border-dashed text-muted-foreground'
                            title={`Inherited via group: ${ir.viaGroup}`}
                          >
                            {ir.name} <span className='text-[9px] opacity-70'>({ir.viaGroup})</span>
                          </Badge>
                        ))}
                        {user.directRoles.length === 0 && user.inheritedRoles.length === 0 && (
                          <span className='text-xs text-muted-foreground'>No roles</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground'>
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleString('id-ID', {
                            timeZone: 'Asia/Jakarta'
                          })
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={(props) => (
                            <Button {...props} variant='ghost' size='sm' className='h-8 w-8 p-0'>
                              <Icons.dots className='h-4 w-4' />
                            </Button>
                          )}
                        />
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem onClick={() => setEditingUser(user)}>
                            <Icons.edit className='mr-2 h-4 w-4' />
                            Edit Memberships
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleSuspension(user)}
                            className={isSuspended ? 'text-primary' : 'text-destructive'}
                          >
                            {isSuspended ? (
                              <>
                                <Icons.check className='mr-2 h-4 w-4' />
                                Reactivate User
                              </>
                            ) : (
                              <>
                                <Icons.close className='mr-2 h-4 w-4' />
                                Suspend User
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className='text-xs text-muted-foreground p-2 rounded-lg bg-muted/30 border border-muted'>
        <span className='font-medium'>Note:</span> Changes to role and group assignments apply immediately to database access. Menus and cached claims update after the user&apos;s next token refresh.
      </div>

      <EditUserDialog
        user={editingUser}
        roles={roles}
        groups={groups}
        open={Boolean(editingUser)}
        onOpenChange={(open) => !open && setEditingUser(null)}
      />
    </div>
  );
}
