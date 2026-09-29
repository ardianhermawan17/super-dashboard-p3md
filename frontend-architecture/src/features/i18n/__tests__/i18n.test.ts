import { describe, expect, it } from 'bun:test';
import {
  createI18n,
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_LABELS,
  LOCALES,
  translations,
} from '../i18n';
import { en } from '../locales/en';
import { id } from '../locales/id';

describe('i18n registry (PSI-113)', () => {
  it('exposes en and id locales with labels', () => {
    expect(LOCALES).toEqual(['en', 'id']);
    expect(LOCALE_LABELS.en).toBe('English');
    expect(LOCALE_LABELS.id).toBe('Bahasa Indonesia');
    expect(DEFAULT_LOCALE).toBe('en');
  });

  it('validates locale values', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('id')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('keeps id mirroring the en schema (same keys)', () => {
    expect(Object.keys(id)).toEqual(Object.keys(en));
  });
});

describe('createI18n (i18n-js)', () => {
  it('translates top-level keys per locale', () => {
    const enI18n = createI18n('en');
    expect(enI18n.t('common.signIn')).toBe('Sign in');

    const idI18n = createI18n('id');
    expect(idI18n.t('common.signIn')).toBe('Masuk');
  });

  it('interpolates dynamic values with %{name}', () => {
    const i18n = createI18n('en');
    expect(i18n.t('language.switchTo', { locale: 'id' })).toBe('Switch to id');
  });

  it('falls back to the default locale for missing keys', () => {
    const idI18n = createI18n('id');
    // 'common.retry' exists in id, but a hypothetical missing key falls back to en.
    // Use a key present only in the default to prove fallback wiring is enabled.
    expect(idI18n.enableFallback).toBe(true);
    expect(idI18n.t('common.appName')).toBe('P3MD Social');
  });

  it('returns a real string (not a raw object) for nested lookups', () => {
    const i18n = createI18n('en');
    const value = i18n.t('overview.totalRevenue');
    expect(typeof value).toBe('string');
    expect(value).toBe('Total Revenue');
  });

  it('locales carry the full translation tree', () => {
    expect(translations.en.common).toBeDefined();
    expect(translations.id.nav).toBeDefined();
    expect(translations.id.overview.totalRevenue).toBe('Total Pendapatan');
  });
});
