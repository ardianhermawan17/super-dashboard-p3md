import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import KanbanViewPage from '@/features/kanban/components/kanban-view-page';

export const metadata = {
  title: 'Dashboard : Kanban view'
};

export default async function page() {
  const session = await getSession();
  if (!session) {
    redirect('/auth/sign-in');
  }

  const canReadFinance = session.permissions.includes('finance.read');
  const canWriteFinance = session.permissions.includes('finance.write');

  return (
    <Suspense>
      <KanbanViewPage canReadFinance={canReadFinance} canWriteFinance={canWriteFinance} />
    </Suspense>
  );
}