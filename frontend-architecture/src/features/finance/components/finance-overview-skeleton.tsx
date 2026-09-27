import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** PSI-106: loading state for the overview finance charts. */
export function FinanceOverviewSkeleton() {
  return (
    <>
      <Card>
        <CardHeader>
          <Skeleton className='h-5 w-[150px]' />
          <Skeleton className='h-4 w-[180px]' />
        </CardHeader>
        <CardContent>
          <div className='flex h-[280px] w-full items-end justify-around gap-2 pt-8'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className='w-full rounded-t-sm'
                style={{ height: `${Math.max(25, 90 - i * 10)}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className='h-5 w-[160px]' />
          <Skeleton className='h-4 w-[140px]' />
        </CardHeader>
        <CardContent className='flex items-center justify-center'>
          <Skeleton className='aspect-square max-h-[280px] w-full rounded-full' />
        </CardContent>
      </Card>
    </>
  );
}