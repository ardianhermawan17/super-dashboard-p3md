'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Modifier } from '@dnd-kit/core';
import {
  Kanban,
  KanbanBoard as KanbanBoardPrimitive,
  KanbanOverlay
} from '@/components/ui/kanban';
import { TaskColumn } from './board-column';
import { TaskCard } from './task-card';
import { TaskDetailDialog } from './task-detail-dialog';
import { KanbanBoardSkeleton } from './kanban-board-skeleton';
import { KanbanBoardEmptyState, KanbanBoardErrorState } from './kanban-state';
import { getBoardAction, moveTaskAction } from '../actions';
import { kanbanKeys } from '../api/keys';
import { positionBetween } from '../lib/position';
import { useBoardRealtime } from '../hooks/use-board-realtime';
import type { KanbanBoardData, KanbanTask } from '../types';

interface KanbanBoardProps {
  boardId?: string;
  initialBoard?: KanbanBoardData | null;
  canReadFinance?: boolean;
  canWriteFinance?: boolean;
}

export function KanbanBoard({
  boardId,
  initialBoard,
  canReadFinance = false,
  canWriteFinance = false,
}: KanbanBoardProps) {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);

  const queryKey = kanbanKeys.board(boardId ?? 'default');

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await getBoardAction(boardId);
      if (res.error) throw new Error(res.error);
      return res.board;
    },
    initialData: initialBoard ?? undefined
  });

  const board = data;

  useBoardRealtime(board?.id);

  const columnsRecord = useMemo(() => {
    const rec: Record<string, KanbanTask[]> = {};
    for (const col of board?.columns || []) {
      rec[col.id] = col.tasks;
    }
    return rec;
  }, [board?.columns]);

  const restrictToBoard: Modifier = useCallback(
    ({ transform, draggingNodeRect }) => {
      const container = containerRef.current;
      if (!draggingNodeRect || !container) {
        return transform;
      }
      const rect = container.getBoundingClientRect();
      const minX = rect.left - draggingNodeRect.left;
      const maxX = rect.right - draggingNodeRect.right;
      const minY = rect.top - draggingNodeRect.top;
      const maxY = rect.bottom - draggingNodeRect.bottom;
      return {
        ...transform,
        x: Math.min(Math.max(transform.x, minX), maxX),
        y: Math.min(Math.max(transform.y, minY), maxY)
      };
    },
    []
  );

  const handleValueChange = useCallback(
    async (nextColumns: Record<string, KanbanTask[]>) => {
      if (!board) return;

      // Find which task moved
      let movedTaskId: string | null = null;
      let targetColId: string | null = null;
      let targetIndex = -1;

      for (const [colId, tasks] of Object.entries(nextColumns)) {
        const prevTasks = columnsRecord[colId] || [];
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const prevIndex = prevTasks.findIndex((t) => t.id === task.id);
          if (prevIndex === -1 || prevIndex !== i) {
            movedTaskId = task.id;
            targetColId = colId;
            targetIndex = i;
            break;
          }
        }
        if (movedTaskId) break;
      }

      if (!movedTaskId || !targetColId || targetIndex === -1) {
        return;
      }

      const targetTasks = nextColumns[targetColId] || [];
      const prevTask = targetIndex > 0 ? targetTasks[targetIndex - 1] : null;
      const nextTask =
        targetIndex < targetTasks.length - 1 ? targetTasks[targetIndex + 1] : null;
      const newPos = positionBetween(prevTask, nextTask);

      // Optimistic cache update
      const previousBoard = qc.getQueryData<KanbanBoardData>(queryKey);

      qc.setQueryData<KanbanBoardData>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          columns: old.columns.map((col) => {
            const colTasks = nextColumns[col.id] || [];
            return {
              ...col,
              tasks: colTasks.map((t) =>
                t.id === movedTaskId
                  ? { ...t, column_id: targetColId!, position: newPos }
                  : t
              )
            };
          })
        };
      });

      const res = await moveTaskAction({
        task_id: movedTaskId,
        to_column_id: targetColId,
        position: newPos
      });

      if (!res.ok) {
        // Rollback on failure
        if (previousBoard) {
          qc.setQueryData(queryKey, previousBoard);
        }
        await qc.invalidateQueries({ queryKey });
      }
    },
    [board, columnsRecord, qc, queryKey]
  );

  if (isLoading && !board) {
      return <KanbanBoardSkeleton />;
    }

    if (isError || !board) {
      return (
        <KanbanBoardErrorState
          message={(error as Error)?.message || 'Unknown error'}
          onRetry={() => {
            void qc.resetQueries({ queryKey });
            void qc.invalidateQueries({ queryKey });
          }}
        />
      );
    }

    if (board.columns.length === 0) {
      return <KanbanBoardEmptyState />;
    }

  return (
      <>
      <div ref={containerRef} className='w-full'>
      <Kanban
      value={columnsRecord}
      onValueChange={handleValueChange}
      getItemValue={(item) => item.id}
      modifiers={[restrictToBoard]}
      autoScroll={false}
      >
      <div className='w-full overflow-x-auto rounded-md pb-4'>
      <KanbanBoardPrimitive className='flex flex-col items-start gap-4 md:flex-row'>
      {board.columns.map((col) => (
          <TaskColumn
          key={col.id}
          value={col.id}
          title={col.title}
          tasks={col.tasks}
          canWriteFinance={canWriteFinance}
          onTaskClick={setSelectedTask}
          />
          ))}
      </KanbanBoardPrimitive>
      </div>
      <KanbanOverlay>
      {({ value, variant }) => {
      if (variant === 'column') {
          const col = board.columns.find((c) => c.id === value);
          if (!col) return null;
          return (
          <TaskColumn
          value={col.id}
          title={col.title}
          tasks={col.tasks}
          canWriteFinance={canWriteFinance}
          onTaskClick={setSelectedTask}
          />
          );
          }

      const task = board.columns
      .flatMap((c) => c.tasks)
      .find((t) => t.id === value);

      if (!task) return null;
          return (
            <TaskCard
              task={task}
              canWriteFinance={canWriteFinance}
              onTaskClick={setSelectedTask}
            />
          );
      }}
      </KanbanOverlay>
      </Kanban>
      </div>

      {/* PSI-109: task detail panel (click to open) */}
      {selectedTask && (
      <TaskDetailDialog
      task={selectedTask}
      columns={board.columns.map((c) => ({ id: c.id, title: c.title }))}
      linkedEvent={board.event ?? null}
      canReadFinance={canReadFinance}
      canWriteFinance={canWriteFinance}
      open={Boolean(selectedTask)}
      onOpenChange={(open) => !open && setSelectedTask(null)}
      />
      )}
      </>
      );
      }
