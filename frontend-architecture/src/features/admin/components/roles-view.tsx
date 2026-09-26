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
import { deleteRoleAction, saveRoleAction } from '../actions';
import type { RoleDetail } from '../types';

export function RolesView({
  initialRoles,
  allPermissions,
  userPermissions
}: {
  initialRoles: RoleDetail[];
  allPermissions: { key: string; module: string; description: string }[];
  userPermissions: string[];
}) {
  const router = useRouter();
  const [editingRole, setEditingRole] = React.useState<RoleDetail | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);

  // Form state
  const [slug, setSlug] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedPermKeys, setSelectedPermKeys] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Group permissions by module
  const permissionsByModule = React.useMemo(() => {
    const map = new Map<string, typeof allPermissions>();
    for (const p of allPermissions) {
      const list = map.get(p.module) || [];
      list.push(p);
      map.set(p.module, list);
    }
    return map;
  }, [allPermissions]);

  const openCreate = () => {
    setSlug('');
    setName('');
    setDescription('');
    setSelectedPermKeys([]);
    setEditingRole(null);
    setIsCreating(true);
  };

  const openEdit = (r: RoleDetail) => {
    setSlug(r.slug);
    setName(r.name);
    setDescription(r.description || '');
    setSelectedPermKeys(r.permissionKeys);
    setEditingRole(r);
    setIsCreating(true);
  };

  const handleSaveRole = async () => {
    if (!slug.trim() || !name.trim()) {
      toast.error('Slug and name are required');
      return;
    }

    setIsSubmitting(true);
    const res = await saveRoleAction({
      id: editingRole?.id,
      slug: slug.trim().toLowerCase(),
      name: name.trim(),
      description: description.trim() || undefined,
      permissionKeys: selectedPermKeys
    });
    setIsSubmitting(false);

    if (!res.ok) {
      toast.error(res.error || 'Failed to save role');
      return;
    }

    toast.success(`Role "${name}" saved`);
    setIsCreating(false);
    router.refresh();
  };

  const handleDeleteRole = async (r: RoleDetail) => {
    if (r.is_system) {
      toast.error('System roles cannot be deleted');
      return;
    }

    if (!confirm(`Are you sure you want to delete role "${r.name}"?`)) return;

    const res = await deleteRoleAction(r.id);
    if (!res.ok) {
      toast.error(res.error || 'Failed to delete role');
      return;
    }

    toast.success(`Role "${r.name}" deleted`);
    router.refresh();
  };

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <p className='text-sm text-muted-foreground'>
          Roles bundle permissions and can be assigned directly to users or inherited through groups.
        </p>
        <Button onClick={openCreate} size='sm' className='gap-1.5'>
          <Icons.add className='h-4 w-4' />
          Create Role
        </Button>
      </div>

      <div className='rounded-xl border border-border bg-card overflow-hidden shadow-xs'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Holders (Direct / Inherited)</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialRoles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <div className='font-medium text-foreground flex items-center gap-2'>
                    {role.name}
                    {role.is_system && (
                      <Badge variant='outline' className='text-[10px] px-1 py-0'>
                        System
                      </Badge>
                    )}
                  </div>
                  {role.description && (
                    <div className='text-xs text-muted-foreground'>{role.description}</div>
                  )}
                </TableCell>
                <TableCell className='font-mono text-xs text-muted-foreground'>
                  {role.slug}
                </TableCell>
                <TableCell>
                  <div className='text-xs'>
                    <span className='font-semibold text-foreground'>{role.totalHoldersCount}</span> holders{' '}
                    <span className='text-muted-foreground'>
                      ({role.directHolderCount} direct, {role.inheritedHolderCount} via groups)
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-1 max-w-sm'>
                    {role.permissionKeys.length === 0 ? (
                      <span className='text-xs text-muted-foreground'>No permissions</span>
                    ) : (
                      role.permissionKeys.slice(0, 4).map((pk) => (
                        <Badge key={pk} variant='secondary' className='text-[10px] px-1.5 py-0'>
                          {pk}
                        </Badge>
                      ))
                    )}
                    {role.permissionKeys.length > 4 && (
                      <span className='text-xs text-muted-foreground font-medium'>
                        +{role.permissionKeys.length - 4} more
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8 w-8 p-0'
                      onClick={() => openEdit(role)}
                      title='Edit role permissions'
                    >
                      <Icons.edit className='h-4 w-4' />
                    </Button>
                    {!role.is_system && (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-8 w-8 p-0 text-destructive hover:text-destructive'
                        onClick={() => handleDeleteRole(role)}
                        title='Delete role'
                      >
                        <Icons.trash className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className='text-xs text-muted-foreground p-2 rounded-lg bg-muted/30 border border-muted'>
        <span className='font-medium'>Note:</span> Changes to role permissions apply immediately to data access and API guards. Menus and client claims refresh on the next token refresh.
      </div>

      {/* Create / Edit Role Dialog with Permission Matrix */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className='sm:max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
            <DialogDescription>
              Configure role details and check permissions in the module matrix. Checkboxes you do not hold permission to grant are disabled.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2'>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <span className='block text-xs font-semibold text-muted-foreground uppercase'>
                  Role Name *
                </span>
                <Input
                  placeholder='Site Reliability'
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editingRole) {
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
                  placeholder='site-reliability'
                  value={slug}
                  disabled={Boolean(editingRole?.is_system)}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
            </div>

            <div className='space-y-1.5'>
              <span className='block text-xs font-semibold text-muted-foreground uppercase'>
                Description
              </span>
              <Textarea
                placeholder='Maintains platform uptime, monitors error rates, and manages integrations'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Permission Matrix Grouped by Module */}
            <div className='space-y-3 pt-2'>
              <span className='block text-xs font-semibold text-foreground uppercase tracking-wider'>
                Permission Matrix
              </span>
              <div className='space-y-4 max-h-80 overflow-y-auto pr-1'>
                {Array.from(permissionsByModule.entries()).map(([moduleName, perms]) => (
                  <div key={moduleName} className='rounded-lg border border-border p-3 bg-muted/10 space-y-2'>
                    <div className='flex items-center justify-between border-b border-border/60 pb-1.5'>
                      <span className='text-xs font-bold text-foreground uppercase tracking-wider'>
                        {moduleName} Module
                      </span>
                      <span className='text-[11px] text-muted-foreground'>
                        {perms.filter((p) => selectedPermKeys.includes(p.key)).length} of {perms.length} selected
                      </span>
                    </div>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1'>
                      {perms.map((perm) => {
                        const isChecked = selectedPermKeys.includes(perm.key);
                        // User can grant permissions they hold or if admin
                        const canGrant = userPermissions.includes('roles.manage') || userPermissions.includes(perm.key);
                        return (
                          <div
                            key={perm.key}
                            className={`flex items-start gap-2 p-2 rounded-md border text-xs transition-colors ${
                              isChecked
                                ? 'bg-primary/10 border-primary/40 text-foreground'
                                : 'bg-background hover:bg-muted/40 border-border text-muted-foreground'
                            } ${!canGrant ? 'opacity-50' : ''}`}
                          >
                            <input
                              type='checkbox'
                              id={`perm-${perm.key}`}
                              aria-label={perm.key}
                              checked={isChecked}
                              disabled={!canGrant}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPermKeys((prev) => [...prev, perm.key]);
                                } else {
                                  setSelectedPermKeys((prev) => prev.filter((k) => k !== perm.key));
                                }
                              }}
                              className='mt-0.5 rounded border-border accent-primary cursor-pointer'
                            />
                            <label htmlFor={`perm-${perm.key}`} className='space-y-0.5 cursor-pointer select-none'>
                              <span className='block font-mono font-medium text-foreground'>{perm.key}</span>
                              <span className='block text-[11px] text-muted-foreground leading-tight'>
                                {perm.description}
                              </span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className='gap-2 sm:gap-0 mt-2'>
            <Button variant='outline' onClick={() => setIsCreating(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
