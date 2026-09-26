import * as React from 'react';
import PageContainer from '@/components/layout/page-container';
import { requirePermission } from '@/lib/auth/require';
import { getAdminRolesData } from '@/features/admin/actions';
import { RolesView } from '@/features/admin/components/roles-view';

export const metadata = {
  title: 'Roles Management | P3MD Social'
};

export default async function AdminRolesPage() {
  await requirePermission('roles.manage');
  const { roles, allPermissions, userPermissions } = await getAdminRolesData();

  return (
    <PageContainer
      pageTitle='Roles'
      pageDescription='Configure custom roles, assign permission matrices, and track role holders across the organization.'
    >
      <RolesView
        initialRoles={roles}
        allPermissions={allPermissions}
        userPermissions={userPermissions}
      />
    </PageContainer>
  );
}
