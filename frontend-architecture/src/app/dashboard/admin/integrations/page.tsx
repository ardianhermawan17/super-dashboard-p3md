import * as React from 'react';
import PageContainer from '@/components/layout/page-container';
import { requireAnyPermission } from '@/lib/auth/require';
import { getAdminIntegrationsData } from '@/features/admin/actions';
import { IntegrationsView } from '@/features/admin/components/integrations-view';

export const metadata = {
  title: 'Google Workspace Integrations | P3MD Social'
};

export default async function AdminIntegrationsPage() {
  await requireAnyPermission(['integrations.manage', 'documents.manage']);
  const data = await getAdminIntegrationsData();

  return (
    <PageContainer
      pageTitle='Integrations'
      pageDescription='Manage Google Workspace integrations: Service Account identity, Drive document roots, access permissions, and linked Google calendars.'
    >
      <IntegrationsView initialData={data} />
    </PageContainer>
  );
}
