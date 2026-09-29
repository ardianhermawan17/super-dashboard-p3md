import { I18n } from 'i18n-js';
import { en, type TranslationSchema } from './locales/en';
import { id } from './locales/id';

export type Locale = 'en' | 'id';

export const LOCALES: Locale[] = ['en', 'id'];

/** Human-readable label for each locale (shown in the switcher). */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
};

/** Nested translation trees, keyed by locale. */
export const translations: Record<Locale, TranslationSchema> = {
  en,
  id,
};

/** Storage key for the persisted locale preference. */
export const LOCALE_STORAGE_KEY = 'p3md_locale';

export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'id';
}

/**
 * Build a configured I18n instance for a locale.
 * `translations` returns the raw nested tree; i18n-js expects it under the
 * locale key.
 */
export function createI18n(locale: Locale): I18n {
  const i18n = new I18n({ [locale]: translations[locale] } as Record<string, unknown>);
  i18n.locale = locale;
  i18n.defaultLocale = DEFAULT_LOCALE;
  i18n.enableFallback = true;
  return i18n;
}
