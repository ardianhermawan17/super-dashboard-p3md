/**
 * Indonesian translation catalog. Mirrors the English schema so the keys line
 * up 1:1; values are Indonesian.
 */
import type { TranslationSchema } from './en';

export const id: TranslationSchema = {
  common: {
    appName: 'P3MD Social',
    loading: 'Memuat…',
    error: 'Terjadi kesalahan',
    retry: 'Coba lagi',
    save: 'Simpan',
    cancel: 'Batal',
    close: 'Tutup',
    search: 'Cari…',
    signIn: 'Masuk',
    signOut: 'Keluar',
  },
  nav: {
    overview: 'Ringkasan',
    kanban: 'Kanban',
    finance: 'Keuangan',
    calendar: 'Kalender',
    aiChat: 'Asisten AI',
    documents: 'Dokumen',
    talent: 'Bakat',
    settings: 'Pengaturan',
  },
  overview: {
    welcome: 'Hai, selamat datang kembali!',
    totalRevenue: 'Total Pendapatan',
    newCustomers: 'Pelanggan Baru',
    activeAccounts: 'Akun Aktif',
    growthRate: 'Tingkat Pertumbuhan',
    live: 'Hidup · Beroperasi',
  },
  language: {
    label: 'Bahasa',
    switchTo: 'Ganti ke %{locale}',
  },
};
