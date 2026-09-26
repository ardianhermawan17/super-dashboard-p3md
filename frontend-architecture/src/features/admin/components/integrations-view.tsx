'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DriveRootDialog } from './drive-root-dialog';
import { CalendarDialog } from './calendar-dialog';
import {
  deleteDriveRootAction,
  deleteGoogleCalendarAction,
  getAdminIntegrationsData,
  triggerSyncAction
} from '../actions';
import type { AdminIntegrationsData, DriveRootItem, GoogleCalendarItem } from '../types';

export function IntegrationsView({ initialData }: { initialData: AdminIntegrationsData }) {
  const [data, setData] = React.useState<AdminIntegrationsData>(initialData);
  const [copied, setCopied] = React.useState(false);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [syncNotice, setSyncNotice] = React.useState<string | null>(null);

  // Dialog state
  const [driveDialogOpen, setDriveDialogOpen] = React.useState(false);
  const [selectedRoot, setSelectedRoot] = React.useState<DriveRootItem | null>(null);

  const [calDialogOpen, setCalDialogOpen] = React.useState(false);
  const [selectedCal, setSelectedCal] = React.useState<GoogleCalendarItem | null>(null);

  const refreshData = async () => {
    try {
      const fresh = await getAdminIntegrationsData();
      setData(fresh);
    } catch {
      // ignore
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(data.saEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSync = async (type: 'drive' | 'calendar', id?: string) => {
    setSyncingId(id || type);
    setSyncNotice(null);
    try {
      const res = await triggerSyncAction(type, id);
      setSyncNotice(res.message);
      await refreshData();
    } finally {
      setTimeout(() => {
        setSyncingId(null);
      }, 1000);
    }
  };

  const handleDeleteRoot = async (rootId: string) => {
    if (!confirm('Are you sure you want to remove this Drive root? Metadata mirror will be preserved or pruned on next sync.')) return;
    await deleteDriveRootAction(rootId);
    await refreshData();
  };

  const handleDeleteCal = async (calId: string) => {
    if (!confirm('Are you sure you want to remove this Google Calendar link?')) return;
    await deleteGoogleCalendarAction(calId);
    await refreshData();
  };

  return (
    <div className='space-y-6'>
      {/* Service Account Identity Banner */}
      <div className='rounded-lg border bg-card p-4 shadow-xs'>
        <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
          <div className='space-y-1'>
            <div className='flex items-center gap-2'>
              <Icons.workspace className='h-4 w-4 text-primary' />
              <h3 className='text-sm font-semibold text-foreground'>Google Service Account Identity</h3>
            </div>
            <p className='text-xs text-muted-foreground'>
              Share Drive folders (as Viewer) and Google Calendars with this service account to enable automated synchronization.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <code className='rounded bg-muted px-2.5 py-1 text-xs font-mono font-medium text-foreground select-all'>
              {data.saEmail}
            </code>
            <Button variant='outline' size='sm' onClick={handleCopyEmail} className='h-8'>
              {copied ? (
                <>
                  <Icons.check className='mr-1.5 h-3.5 w-3.5 text-green-600' />
                  Copied
                </>
              ) : (
                <>
                  <Icons.copy className='mr-1.5 h-3.5 w-3.5' />
                  Copy Email
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {syncNotice && (
        <div className='rounded-md bg-primary/10 p-3 text-xs text-primary flex items-center justify-between'>
          <span>{syncNotice}</span>
          <Button variant='ghost' size='sm' className='h-6 px-1.5 text-xs' onClick={() => setSyncNotice(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue='drive' className='w-full'>
        <div className='flex items-center justify-between border-b pb-2'>
          <TabsList>
            <TabsTrigger value='drive' className='gap-2'>
              <Icons.workspace className='h-4 w-4' />
              Google Drive Roots ({data.driveRoots.length})
            </TabsTrigger>
            <TabsTrigger value='calendar' className='gap-2'>
              <Icons.calendar className='h-4 w-4' />
              Linked Calendars ({data.calendars.length})
            </TabsTrigger>
          </TabsList>

          <div className='flex items-center gap-2'>
            {data.canManageIntegrations && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => handleSync('drive')}
                disabled={Boolean(syncingId)}
              >
                {syncingId === 'drive' ? <Icons.spinner className='mr-1.5 h-3.5 w-3.5 animate-spin' /> : <Icons.refresh className='mr-1.5 h-3.5 w-3.5' />}
                Sync All Roots
              </Button>
            )}
          </div>
        </div>

        {/* DRIVE ROOTS TAB */}
        <TabsContent value='drive' className='space-y-4 pt-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h4 className='text-sm font-semibold'>Configured Document Roots</h4>
              <p className='text-xs text-muted-foreground'>
                Root folders in Google Drive whose metadata is mirrored into the app document library.
              </p>
            </div>
            {data.canManageIntegrations && (
              <Button
                size='sm'
                onClick={() => {
                  setSelectedRoot(null);
                  setDriveDialogOpen(true);
                }}
              >
                <Icons.add className='mr-1.5 h-4 w-4' />
                Add Drive Root
              </Button>
            )}
          </div>

          <div className='rounded-md border'>
            <table className='w-full text-left text-xs'>
              <thead className='bg-muted/50 text-muted-foreground font-medium border-b'>
                <tr>
                  <th className='p-3'>Root Name</th>
                  <th className='p-3'>Folder ID</th>
                  <th className='p-3'>Access Permissions</th>
                  <th className='p-3'>Status</th>
                  <th className='p-3'>Last Sync</th>
                  <th className='p-3 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {data.driveRoots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='p-6 text-center text-muted-foreground'>
                      No Google Drive roots configured yet. Click "Add Drive Root" to connect a folder.
                    </td>
                  </tr>
                ) : (
                  data.driveRoots.map((root) => (
                    <tr key={root.id} className='hover:bg-muted/30 transition-colors'>
                      <td className='p-3 font-medium text-foreground'>
                        {root.name}
                      </td>
                      <td className='p-3 font-mono text-[11px] text-muted-foreground'>
                        <span className='truncate max-w-[160px] inline-block' title={root.folder_id}>
                          {root.folder_id}
                        </span>
                      </td>
                      <td className='p-3'>
                        <div className='flex flex-wrap gap-1 max-w-[260px]'>
                          {root.accessRoles.map((r) => (
                            <Badge key={r.id} variant='secondary' className='text-[10px] px-1.5 py-0'>
                              Role: {r.name}
                            </Badge>
                          ))}
                          {root.accessGroups.map((g) => (
                            <Badge key={g.id} variant='outline' className='text-[10px] px-1.5 py-0'>
                              Group: {g.name}
                            </Badge>
                          ))}
                          {root.accessRoles.length === 0 && root.accessGroups.length === 0 && (
                            <span className='text-destructive text-[11px]'>No access assigned</span>
                          )}
                        </div>
                      </td>
                      <td className='p-3'>
                        <Badge variant={root.enabled ? 'default' : 'outline'} className='text-[10px]'>
                          {root.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className='p-3 text-muted-foreground'>
                        <div>{root.last_synced_at ? new Date(root.last_synced_at).toLocaleString() : 'Never'}</div>
                        {root.last_error && (
                          <div className='text-[10px] text-destructive truncate max-w-[140px]' title={root.last_error}>
                            Err: {root.last_error}
                          </div>
                        )}
                      </td>
                      <td className='p-3 text-right space-x-1.5'>
                        {data.canManageIntegrations && (
                          <>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-7 px-2 text-xs'
                              onClick={() => handleSync('drive', root.id)}
                              disabled={syncingId === root.id}
                            >
                              {syncingId === root.id ? (
                                <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
                              ) : (
                                'Sync'
                              )}
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-7 px-2 text-xs'
                              onClick={() => {
                                setSelectedRoot(root);
                                setDriveDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-7 px-2 text-xs text-destructive hover:bg-destructive/10'
                              onClick={() => handleDeleteRoot(root.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* CALENDARS TAB */}
        <TabsContent value='calendar' className='space-y-4 pt-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h4 className='text-sm font-semibold'>Configured Google Calendars</h4>
              <p className='text-xs text-muted-foreground'>
                Linked Google Calendars for importing into agenda (pull) or exporting app events (push).
              </p>
            </div>
            {data.canManageIntegrations && (
              <Button
                size='sm'
                onClick={() => {
                  setSelectedCal(null);
                  setCalDialogOpen(true);
                }}
              >
                <Icons.add className='mr-1.5 h-4 w-4' />
                Link Calendar
              </Button>
            )}
          </div>

          <div className='rounded-md border'>
            <table className='w-full text-left text-xs'>
              <thead className='bg-muted/50 text-muted-foreground font-medium border-b'>
                <tr>
                  <th className='p-3'>Calendar Name</th>
                  <th className='p-3'>Google Calendar ID</th>
                  <th className='p-3'>Direction</th>
                  <th className='p-3'>Target Audience</th>
                  <th className='p-3'>Status</th>
                  <th className='p-3'>Last Sync</th>
                  <th className='p-3 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y'>
                {data.calendars.length === 0 ? (
                  <tr>
                    <td colSpan={7} className='p-6 text-center text-muted-foreground'>
                      No Google Calendars linked yet. Click "Link Calendar" to connect one.
                    </td>
                  </tr>
                ) : (
                  data.calendars.map((cal) => (
                    <tr key={cal.id} className='hover:bg-muted/30 transition-colors'>
                      <td className='p-3 font-medium text-foreground'>
                        {cal.name}
                      </td>
                      <td className='p-3 font-mono text-[11px] text-muted-foreground'>
                        <span className='truncate max-w-[180px] inline-block' title={cal.calendar_id}>
                          {cal.calendar_id}
                        </span>
                      </td>
                      <td className='p-3'>
                        <Badge variant='outline' className='text-[10px] uppercase font-mono'>
                          {cal.direction}
                        </Badge>
                      </td>
                      <td className='p-3'>
                        {cal.role && (
                          <Badge variant='secondary' className='text-[10px] px-1.5 py-0'>
                            Role: {cal.role.name}
                          </Badge>
                        )}
                        {cal.group && (
                          <Badge variant='outline' className='text-[10px] px-1.5 py-0'>
                            Group: {cal.group.name}
                          </Badge>
                        )}
                      </td>
                      <td className='p-3'>
                        <Badge variant={cal.enabled ? 'default' : 'outline'} className='text-[10px]'>
                          {cal.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className='p-3 text-muted-foreground'>
                        <div>{cal.last_synced_at ? new Date(cal.last_synced_at).toLocaleString() : 'Never'}</div>
                        {cal.last_error && (
                          <div className='text-[10px] text-destructive truncate max-w-[140px]' title={cal.last_error}>
                            Err: {cal.last_error}
                          </div>
                        )}
                      </td>
                      <td className='p-3 text-right space-x-1.5'>
                        {data.canManageIntegrations && (
                          <>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-7 px-2 text-xs'
                              onClick={() => handleSync('calendar', cal.id)}
                              disabled={syncingId === cal.id}
                            >
                              {syncingId === cal.id ? (
                                <Icons.spinner className='h-3.5 w-3.5 animate-spin' />
                              ) : (
                                'Sync'
                              )}
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-7 px-2 text-xs'
                              onClick={() => {
                                setSelectedCal(cal);
                                setCalDialogOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-7 px-2 text-xs text-destructive hover:bg-destructive/10'
                              onClick={() => handleDeleteCal(cal.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <DriveRootDialog
        open={driveDialogOpen}
        onOpenChange={setDriveDialogOpen}
        root={selectedRoot}
        allRoles={data.allRoles}
        allGroups={data.allGroups}
        onSaved={refreshData}
      />

      <CalendarDialog
        open={calDialogOpen}
        onOpenChange={setCalDialogOpen}
        calendar={selectedCal}
        allRoles={data.allRoles}
        allGroups={data.allGroups}
        onSaved={refreshData}
      />
    </div>
  );
}
