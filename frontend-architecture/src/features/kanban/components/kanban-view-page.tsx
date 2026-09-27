'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import PageContainer from '@/components/layout/page-container';
import { Icons } from '@/components/icons';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from './kanban-board';
import NewTaskDialog from './new-task-dialog';
import { BoardShareDialog } from './board-share-dialog';
import { BoardFinancePanel } from '@/features/finance/components/board-finance-panel';
import { getBoardAction } from '../actions';
import { kanbanKeys } from '../api/keys';

type Props = {
  canReadFinance?: boolean;
  canWriteFinance?: boolean;
};

export default function KanbanViewPage({ canReadFinance = false, canWriteFinance = false }: Props) {
  const searchParams = useSearchParams();
  const requestedBoardId = searchParams.get('boardId') || undefined;

  const { data } = useQuery({
    queryKey: kanbanKeys.board(requestedBoardId ?? 'default'),
    queryFn: async () => {
      const res = await getBoardAction(requestedBoardId);
      return res.board;
    }
  });

  const board = data;
  const linkedEvent = board?.event;

  // Format event date for display (WIB locale)
  const eventDateFormatted = linkedEvent
    ? new Date(linkedEvent.starts_at).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : null;

  return (
    <PageContainer
      pageTitle={board?.name || 'Kanban'}
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
      {linkedEvent && (
        <div className='mb-4 inline-flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-3 py-1.5 text-xs'>
          <Icons.calendar className='h-3.5 w-3.5 text-primary' />
          <span className='text-muted-foreground'>
            Linked event:{' '}
            <Link
              href='/dashboard/calendar'
              className='font-medium text-foreground hover:underline'
            >
              {linkedEvent.title} ({eventDateFormatted})
            </Link>
          </span>
        </div>
      )}
      {canReadFinance && board ? (
              <Tabs defaultValue='tasks'>
                <TabsList>
                  <TabsTrigger value='tasks'>Tasks</TabsTrigger>
                  <TabsTrigger value='finance'>Finance</TabsTrigger>
                </TabsList>
                <TabsContent value='tasks' className='mt-4'>
                  <KanbanBoard
                    boardId={requestedBoardId}
                    initialBoard={board}
                    canReadFinance={canReadFinance}
                    canWriteFinance={canWriteFinance}
                  />
                </TabsContent>
                <TabsContent value='finance' className='mt-4'>
                  <BoardFinancePanel boardId={board.id} canWrite={canWriteFinance} />
                </TabsContent>
              </Tabs>
            ) : (
              <KanbanBoard
                boardId={requestedBoardId}
                initialBoard={board}
                canReadFinance={canReadFinance}
                canWriteFinance={canWriteFinance}
              />
            )}
    </PageContainer>
  );
}