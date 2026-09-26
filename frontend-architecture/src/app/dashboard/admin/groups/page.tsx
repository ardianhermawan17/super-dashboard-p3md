import * as React from 'react';
import PageContainer from '@/components/layout/page-container';
import { requirePermission } from '@/lib/auth/require';
import { getAdminGroupsData } from '@/features/admin/actions';
import { GroupsView } from '@/features/admin/components/groups-view';

export const metadata = {
  title: 'Groups Management | P3MD Social'
};

export default async function AdminGroupsPage() {
  await requirePermission('groups.manage');
  const { groups, allRoles, allUsers } = await getAdminGroupsData();

  return (
    <PageContainer
      pageTitle='Groups'
      pageDescription='Organize users into teams and batches, and assign common roles.'
    >
      <GroupsView initialGroups={groups} allRoles={allRoles} allUsers={allUsers} />
    </PageContainer>
  );
}
