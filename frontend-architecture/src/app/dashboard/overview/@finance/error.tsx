'use client';

import { Button } from '@/components/ui/button';
import { StatsErrorAlert } from '@/features/overview/components/stats-error';
import { useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function FinanceError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <StatsErrorAlert
      message={`Failed to load finance charts: ${error.message}`}
      action={
        <Button variant='outline' size='sm' onClick={retry} disabled={isPending}>
          {isPending ? 'Retrying...' : 'Try again'}
        </Button>
      }
    />
  );
}