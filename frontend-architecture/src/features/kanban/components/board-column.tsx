'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KanbanColumn, KanbanColumnHandle } from '@/components/ui/kanban';
import type { KanbanTask } from '../types';
import { TaskCard } from './task-card';
import { KanbanColumnEmptyState } from './kanban-state';

interface TaskColumnProps extends Omit<React.ComponentProps<typeof KanbanColumn>, 'children'> {
  title: string;
  tasks: KanbanTask[];
  canWriteFinance?: boolean;
  onTaskClick?: (task: KanbanTask) => void;
}

export function TaskColumn({
  value,
  title,
  tasks,
  canWriteFinance = false,
  onTaskClick,
  ...props
}: TaskColumnProps) {
  return (
    <KanbanColumn value={value} className='w-full shrink-0 md:w-[320px]' {...props}>
      <div className='flex items-center justify-between pb-2'>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-semibold'>{title}</span>
          <Badge variant='secondary' className='pointer-events-none rounded-sm px-1.5 py-0 text-xs'>
            {tasks.length}
          </Badge>
        </div>
        <KanbanColumnHandle render={<Button variant='ghost' size='icon' className='h-6 w-6' />}>
          <Icons.gripVertical className='h-4 w-4 text-muted-foreground' />
        </KanbanColumnHandle>
      </div>
      <div className='flex flex-col gap-2 p-0.5 min-h-[100px]'>
            {tasks.length === 0 ? (
              <KanbanColumnEmptyState />
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  asHandle
                  canWriteFinance={canWriteFinance}
                  onTaskClick={onTaskClick}
                />
              ))
            )}
          </div>
    </KanbanColumn>
  );
}
