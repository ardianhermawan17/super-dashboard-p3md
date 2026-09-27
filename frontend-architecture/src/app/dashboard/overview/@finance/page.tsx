import { getSession } from '@/lib/auth/session';
import { getFinanceOverviewAction } from '@/features/finance/actions';
import { OverviewFinanceGraphs } from '@/features/finance/components/overview-finance-graphs';

/** PSI-106: overview Finance slot — data-driven, finance.read only. */
export default async function FinanceStats() {
  const session = await getSession();
  if (!session?.permissions.includes('finance.read')) {
    return null;
  }

  const res = await getFinanceOverviewAction();
  if (!res.ok) {
    return (
      <p className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
        Finance data unavailable.
      </p>
    );
  }

  return <OverviewFinanceGraphs data={res.data} />;
}