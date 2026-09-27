import { Suspense } from 'react';
import KanbanViewPage from '@/features/kanban/components/kanban-view-page';

export const metadata = {
  title: 'Dashboard : Kanban view'
};

export default function page() {
  return (
    <Suspense>
      <KanbanViewPage />
    </Suspense>
  );
}
