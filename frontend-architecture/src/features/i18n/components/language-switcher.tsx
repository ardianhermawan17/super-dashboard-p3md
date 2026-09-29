'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useI18n } from '../i18n-provider';
import { LOCALE_LABELS, LOCALES } from '../i18n';

/**
 * Header language switcher. Toggles between the supported locales and
 * persists the choice (handled by I18nProvider).
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant='ghost' size='icon' className='h-8 w-8' />}
        aria-label={t('language.label')}
      >
        <Icons.language className='h-4 w-4' />
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-44'>
        <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l}
            className='justify-between gap-2'
            onClick={() => setLocale(l)}
            disabled={l === locale}
          >
            <span>{LOCALE_LABELS[l]}</span>
            {l === locale && <Icons.check className='h-4 w-4' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
