'use client';

import * as React from 'react';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { listConnectedAppsAction, revokeConnectedAppAction } from '../actions';
import { ConnectedAppCard } from './connected-app-card';
import { RevokeAppDialog } from './revoke-app-dialog';
import type { ConnectedAppGrant, OAuthClientInfo } from '../types';

export default function ConnectedAppsPage() {
  const [grants, setGrants] = React.useState<ConnectedAppGrant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [targetClient, setTargetClient] = React.useState<OAuthClientInfo | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);

  const fetchGrants = React.useCallback(async (showToast = false) => {
    try {
      const res = await listConnectedAppsAction();
      if (res.ok) {
        setGrants(res.data);
        if (showToast) toast.success('Connected applications refreshed');
      } else {
        toast.error(res.error || 'Failed to load connected applications');
      }
    } catch {
      toast.error('Could not connect to authentication service');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchGrants();
  }, [fetchGrants]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGrants(true);
  };

  const handleOpenRevoke = (grant: ConnectedAppGrant) => {
    setTargetClient(grant.client);
    setDialogOpen(true);
  };

  const handleConfirmRevoke = async (client: OAuthClientInfo) => {
    setRevoking(true);
    try {
      const res = await revokeConnectedAppAction(client.id);
      if (res.ok) {
        toast.success(`Access revoked for ${client.name}`);
        setDialogOpen(false);
        setTargetClient(null);
        // Optimistically remove from state and refresh
        setGrants((prev) => prev.filter((g) => g.client.id !== client.id));
      } else {
        toast.error(res.error || 'Failed to revoke access');
      }
    } catch {
      toast.error('Network error during revocation');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <PageContainer
      pageTitle='Connected Apps'
      pageDescription='Manage external MCP clients and AI agents authorized to access your account via OAuth 2.1.'
      pageHeaderAction={
        <Button
          variant='outline'
          size='sm'
          onClick={handleRefresh}
          disabled={loading || refreshing}
        >
          <Icons.refresh className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      }
    >
      <div className='space-y-6 max-w-5xl'>
        {/* Info Banner */}
        <div className='flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm'>
          <Icons.info className='mt-0.5 h-4 w-4 text-primary shrink-0' />
          <div className='space-y-1 text-muted-foreground'>
            <p className='text-xs sm:text-sm text-foreground font-medium'>
              How external agents access your data
            </p>
            <p className='text-xs sm:text-sm leading-relaxed'>
              When you connect tools like Claude Desktop, ChatGPT, or custom MCP agents to P3MD, they
              receive access scoped to your user permissions. Because OAuth 2.1 auto-approves
              repeat authorizations, revoking an app here is your explicit switch to disconnect it.
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className='space-y-4'>
            {[1, 2].map((i) => (
              <Card key={i} className='animate-pulse p-6'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-4'>
                    <div className='h-12 w-12 rounded-xl bg-muted' />
                    <div className='space-y-2'>
                      <div className='h-4 w-36 rounded bg-muted' />
                      <div className='h-3 w-24 rounded bg-muted' />
                    </div>
                  </div>
                  <div className='h-8 w-28 rounded bg-muted' />
                </div>
                <div className='mt-4 pt-4 border-t'>
                  <div className='h-5 w-48 rounded bg-muted' />
                </div>
              </Card>
            ))}
          </div>
        ) : grants.length > 0 ? (
          /* Active Grants List */
          <div className='space-y-4'>
            <div className='flex items-center justify-between text-xs text-muted-foreground px-1'>
              <span>{grants.length} {grants.length === 1 ? 'application' : 'applications'} connected</span>
            </div>
            {grants.map((grant) => (
              <ConnectedAppCard
                key={grant.client.id}
                grant={grant}
                onRevoke={handleOpenRevoke}
                disabled={revoking}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <Card className='border-dashed'>
            <CardContent className='flex flex-col items-center justify-center py-12 text-center'>
              <div className='flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 mb-4'>
                <Icons.laptop className='h-6 w-6 text-muted-foreground' />
              </div>
              <h3 className='text-base font-semibold text-foreground mb-1'>
                No connected applications
              </h3>
              <p className='text-xs sm:text-sm text-muted-foreground max-w-sm mb-6'>
                You have not authorized any external agents or applications yet. When you connect an
                MCP client via OAuth, it will appear here.
              </p>
              <div className='flex items-center gap-2 text-xs text-muted-foreground border rounded-md px-3 py-1.5 bg-muted/20'>
                <Icons.code className='h-3.5 w-3.5 text-primary' />
                <span>MCP Server endpoint: <code className='font-mono font-medium text-foreground'>/api/mcp</code></span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Revocation Confirmation Dialog */}
      <RevokeAppDialog
        client={targetClient}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={handleConfirmRevoke}
        loading={revoking}
      />
    </PageContainer>
  );
}
