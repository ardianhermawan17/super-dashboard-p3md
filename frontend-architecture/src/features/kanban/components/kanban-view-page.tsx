'use client';

import { useQuery } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { KanbanBoard } from './kanban-board';
import NewTaskDialog from './new-task-dialog';
import { BoardShareDialog } from './board-share-dialog';
import { getBoardAction } from '../actions';
import { kanbanKeys } from '../api/keys';

export default function KanbanViewPage() {
  const { data } = useQuery({
    queryKey: kanbanKeys.board('default'),
    queryFn: async () => {
      const res = await getBoardAction();
      return res.board;
    }
  });

  const board = data;

  return (
    <PageContainer
      pageTitle='Kanban'
      pageDescription='Manage tasks with drag and drop'
      pageHeaderAction={
        board ? (
          <div className='flex items-center gap-2'>
            <BoardShareDialog boardId={board.id} />
            <NewTaskDialog
              boardId={board.id}
              columns={board.columns.map((c) => ({ id: c.id, title: c.title }))}
            />
          </div>
        ) : null
      }
    >
      <KanbanBoard />
    </PageContainer>
  );
}
