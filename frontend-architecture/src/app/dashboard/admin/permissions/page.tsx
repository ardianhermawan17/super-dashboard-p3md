import * as React from 'react';
import PageContainer from '@/components/layout/page-container';
import { requirePermission } from '@/lib/auth/require';
import { getAdminPermissionsCatalogueData } from '@/features/admin/actions';
import { PermissionsView } from '@/features/admin/components/permissions-view';

export const metadata = {
  title: 'Permissions Catalogue | P3MD Social'
};

export default async function AdminPermissionsPage() {
  await requirePermission('roles.manage');
  const { permissions } = await getAdminPermissionsCatalogueData();

  return (
    <PageContainer
      pageTitle='Permissions'
      pageDescription='Read-only catalogue of all capabilities, their parent modules, and which roles currently grant them.'
    >
      <PermissionsView permissions={permissions} />
    </PageContainer>
  );
}
