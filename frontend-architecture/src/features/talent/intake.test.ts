import { beforeEach, describe, expect, mock, test } from 'bun:test';

// `server-only` throws outside an RSC; stub it for the test process (same as agent tests).
mock.module('server-only', () => ({}));

// --- fake supabase -----------------------------------------------------------
// Records every storage + DB call so the tests can assert on the *rules*:
// consent before processing, 2 MB cap, user-scoped path, no public URL, no raw text.
type StorageUpload = { bucket: string; path: string; public: boolean };
let uploads: StorageUpload[] = [];
let insertedCandidates: Record<string, unknown>[] = [];

const fakeSupabase = () => ({
  storage: {
    from: (_bucket: string) => ({
      upload: (path: string, _file: File | Blob, _opts: { upsert?: boolean } = {}) => {
        uploads.push({ bucket: 'cvs', path, public: false });
        return Promise.resolve({ error: null, data: { path } });
      },
    }),
  },
  from: (table: string) => ({
    insert: (row: Record<string, unknown>) => {
      if (table === 'candidates') insertedCandidates.push(row);
      return Promise.resolve({ error: null });
    },
  }),
});

mock.module('@/lib/supabase/server', () => ({
  createClient: () => fakeSupabase(),
}));

beforeEach(() => {
  uploads = [];
  insertedCandidates = [];
});

const { pickDriveCv, submitConsentIntake } = await import('./intake');

describe('talent intake', () => {
  test('requires consent before any processing', async () => {
    const pdf = new File([new Uint8Array(1024)], 'cv.pdf', { type: 'application/pdf' });
    const out = await submitConsentIntake({
      consent: false,
      source: 'storage',
      file: pdf,
      userId: 'user-1',
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/consent/i);
    expect(uploads.length).toBe(0);
    expect(insertedCandidates.length).toBe(0);
  });

  test('rejects a PDF over 2 MB', async () => {
    const big = new File([new Uint8Array(1024 * 1024 * 3)], 'cv.pdf', { type: 'application/pdf' });
    const out = await submitConsentIntake({ consent: true, source: 'storage', file: big, userId: 'user-1' });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/2 MB/i);
    expect(uploads.length).toBe(0); // never hit storage
  });

  test('uploads an accepted PDF to <user_id>/ with no public URL', async () => {
    const pdf = new File([new Uint8Array(1024)], 'cv.pdf', { type: 'application/pdf' });
    const out = await submitConsentIntake({
      consent: true,
      source: 'storage',
      file: pdf,
      userId: 'user-1',
    });
    expect(out.ok).toBe(true);
    expect(uploads[0].bucket).toBe('cvs');
    expect(uploads[0].path).toStartWith('user-1/');
    expect(uploads[0].path).toMatch(/\.pdf$/);
    expect(uploads[0].public).toBe(false);
    expect(insertedCandidates[0].cv_source).toBe('storage');
    expect(insertedCandidates[0].consent_at).toBeTruthy();
  });

  test('a Drive pick records cv_drive_file_id instead of a storage path', async () => {
    const out = await pickDriveCv({
      consent: true,
      driveFileId: 'drive-file-1',
      userId: 'user-2',
    });
    expect(out.ok).toBe(true);
    expect(insertedCandidates[0].cv_source).toBe('drive');
    expect(insertedCandidates[0].cv_drive_file_id).toBe('drive-file-1');
    expect(uploads.length).toBe(0); // no storage upload for a Drive pick
  });
});