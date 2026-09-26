import * as React from 'react';
import PageContainer from '@/components/layout/page-container';
import { requirePermission } from '@/lib/auth/require';
import { getAdminUsersData } from '@/features/admin/actions';
import { UsersTable } from '@/features/admin/components/users-table';

export const metadata = {
  title: 'User Management | P3MD Social'
};

export default async function AdminUsersPage() {
  await requirePermission('users.read');
  const { users, roles, groups } = await getAdminUsersData();

  return (
    <PageContainer
      pageTitle='Users'
      pageDescription='Manage workspace members, assign direct and group-inherited roles, and invite new users.'
    >
      <UsersTable initialUsers={users} roles={roles} groups={groups} />
    </PageContainer>
  );
}
