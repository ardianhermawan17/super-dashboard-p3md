'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { KanbanItem } from '@/components/ui/kanban';
import { TaskFinanceButton } from './task-finance-button';
import type { KanbanTask } from '../types';

interface TaskCardProps extends Omit<React.ComponentProps<typeof KanbanItem>, 'value'> {
  task: KanbanTask;
  canWriteFinance?: boolean;
  /** PSI-109: invoked on a genuine card click (pointer down+up without dragging). */
  onTaskClick?: (task: KanbanTask) => void;
}

const DRAG_THRESHOLD_PX = 6;

export function TaskCard({ task, canWriteFinance = false, onTaskClick, ...props }: TaskCardProps) {
  const assigneeName = task.assignee?.full_name || null;
  const pointerStart = React.useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    // Not a drag (finger/mouse barely moved) → treat as a click.
    if (Math.max(dx, dy) <= DRAG_THRESHOLD_PX && onTaskClick) {
      onTaskClick(task);
    }
  };

  return (
    <KanbanItem
      key={task.id}
      value={task.id}
      {...props}
      render={<div className='bg-card rounded-md border p-3 shadow-xs hover:border-foreground/20 transition-colors' />}
    >
      <div
        className='flex flex-col gap-2'
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div className='flex items-start justify-between gap-2'>
          <span className='line-clamp-2 text-sm font-medium'>{task.title}</span>
          <Badge
            variant={
              task.priority === 'high'
                ? 'destructive'
                : task.priority === 'medium'
                  ? 'default'
                  : 'secondary'
            }
            className='pointer-events-none h-5 shrink-0 rounded-sm px-1.5 text-[11px] capitalize'
          >
            {task.priority}
          </Badge>
        </div>
        {task.description && (
          <p className='line-clamp-2 text-xs text-muted-foreground'>{task.description}</p>
        )}
        <div className='text-muted-foreground flex items-center justify-between text-xs pt-1'>
          {assigneeName ? (
            <div className='flex items-center gap-1.5'>
              <div className='bg-primary/20 size-2 rounded-full' />
              <span className='line-clamp-1 max-w-[140px]'>{assigneeName}</span>
            </div>
          ) : (
            <span />
          )}
          <div className='flex items-center gap-1'>
            {canWriteFinance && <TaskFinanceButton boardId={task.board_id} taskId={task.id} />}
            {task.due_date && <time className='text-[10px] tabular-nums'>{task.due_date}</time>}
          </div>
        </div>
      </div>
    </KanbanItem>
  );
}