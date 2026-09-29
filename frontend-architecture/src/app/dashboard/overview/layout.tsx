import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter
} from '@/components/ui/card';
import { Icons } from '@/components/icons';
import { getSession } from '@/lib/auth/session';
import { getLatestDigestAction } from '@/features/overview/actions';
import { DailyDigestCard } from '@/features/overview/components/daily-digest-card';
import { AnimatedStatsGrid } from '@/features/overview/components/animated-stats-grid';
import { AnimatedChartsGrid } from '@/features/overview/components/animated-charts-grid';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { WelcomeBanner } from '@/features/overview/components/welcome-banner';
import React from 'react';

export default async function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats,
  finance
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  bar_stats: React.ReactNode;
  area_stats: React.ReactNode;
  finance: React.ReactNode;
}) {
  const session = await getSession();
  const canReadFinance = session?.permissions.includes('finance.read') ?? false;
  const canReceiveDigest =
    session?.permissions.includes('digest.receive') ||
    session?.permissions.includes('agent.audit') ||
    false;

  const digestRes = canReceiveDigest ? await getLatestDigestAction() : null;
  const digest = digestRes?.ok ? digestRes.data : null;

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col gap-4'>
      <WelcomeBanner />

        {canReceiveDigest && digest ? <DailyDigestCard digest={digest} /> : null}

        <AnimatedStatsGrid>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                <AnimatedNumber value={1250} prefix='$' decimals={2} />
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingUp />
                  +12.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                Trending up this month <Icons.trendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>Visitors for the last 6 months</div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>New Customers</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                <AnimatedNumber value={1234} />
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingDown />
                  -20%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                Down 20% this period <Icons.trendingDown className='size-4' />
              </div>
              <div className='text-muted-foreground'>Acquisition slowdown</div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Active Accounts</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                <AnimatedNumber value={45678} />
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingUp />
                  +12.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                Strong user retention <Icons.trendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>Engagement exceed targets</div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Growth Rate</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                <AnimatedNumber value={4.5} suffix='%' decimals={1} />
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <Icons.trendingUp />
                  +4.5%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                Steady performance increase <Icons.trendingUp className='size-4' />
              </div>
              <div className='text-muted-foreground'>Meets growth projections</div>
            </CardFooter>
          </Card>
        </AnimatedStatsGrid>

        <AnimatedChartsGrid
          barStats={bar_stats}
          sales={sales}
          areaStats={area_stats}
          pieStats={pie_stats}
        />

        {canReadFinance && (
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            {finance}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
