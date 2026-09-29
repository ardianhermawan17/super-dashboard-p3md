import { Skeleton } from '@/components/ui/skeleton';

/**
 * PSI-112: Skeleton loading state matching the Kanban board's layout shape.
 * Three columns with task-card shaped skeletons, respecting the existing
 * Skeleton primitive (muted pulse) instead of a generic spinner.
 */
const COLUMN_TITLES = ['Todo', 'In Progress', 'Done'];

export function KanbanBoardSkeleton() {
  return (
    <div className='w-full overflow-x-auto rounded-md pb-4' aria-busy='true' aria-label='Loading board'>
      <div className='flex flex-col items-start gap-4 md:flex-row'>
        {COLUMN_TITLES.map((title, colIdx) => (
          <div
            key={title}
            className='w-full shrink-0 space-y-2 md:w-[320px]'
            data-testid='kanban-skeleton-column'
          >
            <div className='flex items-center gap-2 pb-2'>
              <Skeleton className='h-5 w-[100px]' />
              <Skeleton className='h-4 w-6 rounded-full' />
            </div>
            {/* Task-card shaped placeholders */}
            {Array.from({ length: colIdx + 2 }).map((_, i) => (
              <div
                key={i}
                className='flex flex-col gap-2 rounded-md border bg-card p-3 shadow-xs'
                data-testid='kanban-skeleton-card'
              >
                <Skeleton className='h-4 w-3/4' />
                <Skeleton className='h-3 w-full' />
                <Skeleton className='h-3 w-1/2' />
                <div className='flex items-center justify-between pt-1'>
                  <Skeleton className='h-3 w-20' />
                  <Skeleton className='h-3 w-12' />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
