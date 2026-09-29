/**
 * English translation catalog (default locale).
 * Keys follow a `domain.section.key` convention.
 */
export const en = {
  common: {
    appName: 'P3MD Social',
    loading: 'Loading…',
    error: 'Something went wrong',
    retry: 'Retry',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    search: 'Search…',
    signIn: 'Sign in',
    signOut: 'Sign out',
  },
  nav: {
    overview: 'Overview',
    kanban: 'Kanban',
    finance: 'Finance',
    calendar: 'Calendar',
    aiChat: 'AI Chat',
    documents: 'Documents',
    talent: 'Talent',
    settings: 'Settings',
  },
  overview: {
    welcome: 'Hi, welcome back!',
    totalRevenue: 'Total Revenue',
    newCustomers: 'New Customers',
    activeAccounts: 'Active Accounts',
    growthRate: 'Growth Rate',
    live: 'Live · Operational',
  },
  language: {
    label: 'Language',
    switchTo: 'Switch to %{locale}',
  },
};

/**
 * Shape of a translation tree. Values are strings; locales must share the
 * same key structure so `t()` lookups are type-stable across languages.
 */
export type TranslationSchema = typeof en;

