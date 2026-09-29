'use client';
import React from 'react';
import { ActiveThemeProvider } from '@/components/themes/active-theme';
import QueryProvider from '@/components/layout/query-provider';
import { TourProvider } from '@/features/tour/context/tour-context';
import { TourModal } from '@/features/tour/components/tour-modal';
import { I18nProvider } from '@/features/i18n/i18n-provider';

export default function Providers({
  activeThemeValue,
  children
}: {
  activeThemeValue: string;
  children: React.ReactNode;
}) {
  return (
    <ActiveThemeProvider initialTheme={activeThemeValue}>
      <QueryProvider>
        <I18nProvider>
          <TourProvider>
            {children}
            <TourModal />
          </TourProvider>
        </I18nProvider>
      </QueryProvider>
    </ActiveThemeProvider>
  );
}
