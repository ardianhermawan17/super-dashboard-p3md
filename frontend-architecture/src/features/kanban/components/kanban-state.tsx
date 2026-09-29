'use client';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

/**
 * PSI-112: Composed empty and error states for the Kanban board.
 * Skill §4.5: "Beautifully composed" empty states that indicate how to
 * populate, and contextual error states with a recovery action.
 */

export function KanbanBoardErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role='alert'
      className='flex flex-col items-center justify-center gap-3 p-12 text-center'
      data-testid='kanban-error-state'
    >
      <div className='flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive'>
        <Icons.toastWarning className='h-6 w-6' />
      </div>
      <div className='space-y-1'>
        <p className='text-sm font-semibold text-foreground'>Couldn&apos;t load this board</p>
        <p className='max-w-sm text-xs text-muted-foreground'>{message}</p>
      </div>
      <Button variant='outline' size='sm' onClick={onRetry}>
        <Icons.refresh className='mr-1.5 h-3.5 w-3.5' />
        Retry
      </Button>
    </div>
  );
}

export function KanbanBoardEmptyState() {
  return (
    <div
      className='flex flex-col items-center justify-center gap-2 p-12 text-center'
      data-testid='kanban-empty-state'
    >
      <div className='flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground'>
        <Icons.add className='h-5 w-5' />
      </div>
      <p className='text-sm font-medium text-foreground'>No cards on this board yet</p>
      <p className='max-w-xs text-xs text-muted-foreground'>
        Drag in a card from another column, or create your first task to get started.
      </p>
    </div>
  );
}

export function KanbanColumnEmptyState() {
  return (
    <div
      className='flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-6 text-center'
      data-testid='kanban-column-empty'
    >
      <p className='text-xs font-medium text-muted-foreground'>No cards yet</p>
      <p className='text-[11px] text-muted-foreground/70'>Drag cards here to move them</p>
    </div>
  );
}