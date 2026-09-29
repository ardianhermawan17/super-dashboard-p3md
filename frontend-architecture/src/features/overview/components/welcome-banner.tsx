'use client';

import { useI18n } from '@/features/i18n/i18n-provider';
import { LivePulseBadge } from '@/components/ui/live-pulse';

/**
 * Client-side welcome banner so it can render translated copy via useI18n.
 * (The overview layout itself is a Server Component and cannot call the hook.)
 */
export function WelcomeBanner() {
  const { t } = useI18n();
  return (
    <div className='flex items-center justify-between'>
      <h2 className='text-2xl font-bold tracking-tight'>{t('overview.welcome')}</h2>
      <LivePulseBadge label={t('overview.live')} />
    </div>
  );
}
