'use client';

import * as React from 'react';
import { I18n } from 'i18n-js';
import {
  createI18n,
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_STORAGE_KEY,
  type Locale,
} from './i18n';

type Interpolations = Record<string, string | number>;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a dotted key with optional interpolations. */
  t: (scope: string, options?: Interpolations) => string;
  i18n: I18n;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(readStoredLocale);
  const [i18n, setI18n] = React.useState<I18n>(() => createI18n(readStoredLocale()));

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    setI18n(createI18n(next));
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      document.documentElement.lang = next;
    }
  }, []);

  // Apply the locale to <html lang> on mount (no-js-safe baseline).
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (scope, options) =>
        String(options ? i18n.t(scope, options as Record<string, unknown>) : i18n.t(scope)),
      i18n,
    }),
    [locale, setLocale, i18n],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an <I18nProvider>.');
  }
  return ctx;
}
