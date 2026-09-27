'use client';

import { Bar, BarChart, Pie, PieChart, XAxis, LabelList } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import type { FinanceOverview } from '../overview-lib';
import { formatIDR } from '../lib/format';

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function monthShort(key: string): string {
  const [, mm] = key.split('-');
  return MONTH_LABELS[Number(mm) - 1] ?? key;
}

const PIE_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)'
];

/** PSI-106: inflow vs outflow per month (bar) + outflow by category (pie). */
export function OverviewFinanceGraphs({ data }: { data: FinanceOverview }) {
  const barData = data.monthly.map((m) => ({
    month: m.month,
    inflow: Number(m.inflow),
    outflow: Number(m.outflow)
  }));

  const hasEntries = barData.some((m) => m.inflow > 0 || m.outflow > 0);

  const pieData = data.outflowByCategory.map((c, i) => ({
    category: c.name,
    slug: c.slug,
    value: Number(c.total),
    fill: c.slug === 'other' ? 'var(--muted-foreground)' : PIE_COLORS[i % PIE_COLORS.length]
  }));

  const barConfig = {
    inflow: { label: 'Inflow', color: 'var(--chart-1)' },
    outflow: { label: 'Outflow', color: 'var(--chart-2)' }
  } satisfies ChartConfig;

  const pieConfig = Object.fromEntries(
    pieData.map((p, i) => [
      p.slug,
      {
        label: p.category,
        color: p.slug === 'other' ? 'var(--muted-foreground)' : PIE_COLORS[i % PIE_COLORS.length]
      }
    ])
  ) satisfies ChartConfig;

  return (
    <>
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>Inflow vs outflow</CardTitle>
          <CardDescription>Per month · last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          {hasEntries ? (
            <ChartContainer config={barConfig} className='h-[280px] w-full'>
              <BarChart accessibilityLayer data={barData}>
                <XAxis
                  dataKey='month'
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={monthShort}
                />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey='inflow' fill='var(--color-inflow)' radius={4} />
                <Bar dataKey='outflow' fill='var(--color-outflow)' radius={4} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className='flex h-[280px] items-center justify-center text-sm text-muted-foreground'>
              No finance entries in the last 6 months.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>Outflow by category</CardTitle>
          <CardDescription>Last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          {pieData.length > 0 ? (
            <ChartContainer config={pieConfig} className='mx-auto aspect-square max-h-[280px]'>
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={pieData}
                  dataKey='value'
                  nameKey='slug'
                  innerRadius={30}
                  strokeWidth={5}
                  cornerRadius={8}
                  paddingAngle={4}
                >
                  <LabelList
                    dataKey='category'
                    stroke='none'
                    fontSize={11}
                    fontWeight={500}
                    position='outside'
                    formatter={(value: unknown) => (pieData.length <= 5 ? String(value) : '')}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : (
            <p className='flex aspect-square max-h-[280px] items-center justify-center text-sm text-muted-foreground'>
              No outflow entries yet.
            </p>
          )}
          {pieData.length > 0 && (
            <div className='mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
              {pieData.map((p) => (
                <span key={p.slug} className='inline-flex items-center gap-1.5'>
                  <span
                    className='size-2 rounded-full'
                    style={{ backgroundColor: p.fill }}
                  />
                  {p.category} · {formatIDR(p.value.toString())}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}