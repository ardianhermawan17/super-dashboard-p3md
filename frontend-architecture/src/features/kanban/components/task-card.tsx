'use client';

import { Badge } from '@/components/ui/badge';
import { KanbanItem } from '@/components/ui/kanban';
import type { KanbanTask } from '../types';

interface TaskCardProps extends Omit<React.ComponentProps<typeof KanbanItem>, 'value'> {
  task: KanbanTask;
}

export function TaskCard({ task, ...props }: TaskCardProps) {
  const assigneeName = task.assignee?.full_name || null;

  return (
    <KanbanItem
      key={task.id}
      value={task.id}
      {...props}
      render={<div className='bg-card rounded-md border p-3 shadow-xs hover:border-foreground/20 transition-colors' />}
    >
      <div className='flex flex-col gap-2'>
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
          {task.due_date && <time className='text-[10px] tabular-nums'>{task.due_date}</time>}
        </div>
      </div>
    </KanbanItem>
  );
}
