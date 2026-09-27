import PageContainer from '@/components/layout/page-container';
import { requirePermission } from '@/lib/auth/require';
import { EntriesTable } from '@/features/finance/components/entries-table';

export const metadata = {
  title: 'Dashboard: Finance'
};

export default async function FinancePage() {
  const session = await requirePermission('finance.read');
  const canWrite = session.permissions.includes('finance.write');
  const canManage = session.permissions.includes('finance.manage');

  return (
    <PageContainer
      pageTitle='Finance'
      pageDescription='Income and spending across the boards you can see.'
    >
      <EntriesTable canWrite={canWrite} canManage={canManage} />
    </PageContainer>
  );
}
