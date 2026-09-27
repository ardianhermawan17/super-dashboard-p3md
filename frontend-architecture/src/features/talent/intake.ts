import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Consent + CV intake (PSI-081).
 *
 * Rules enforced here (from docs/frontend-architecture/features/talent.md and C-08, C-18):
 * - explicit consent must be recorded before any processing — no consent, no insert;
 * - an uploaded PDF must be ≤ 2 MB and go to the private `cvs` bucket at `<user_id>/<uuid>.pdf`;
 * - raw CV text never reaches the browser; we return a success/error, never the content.
 *
 * The client is the cookie-scoped server client: RLS on `candidates` requires
 * `user_id = auth.uid()`, so the caller's own session is what authorises the insert. A
 * key-only client would carry no user and be rejected.
 *
 * The server action in `./actions.ts` supplies the caller's `userId` from the session; this
 * module is what the tests pin down, so the rules live in one testable place.
 */

export type IntakeResult = { ok: true } | { ok: false; error: string };

const MAX_CV_BYTES = 2 * 1024 * 1024; // 2 MB

function validConsent(consent: boolean): consent is true {
  return consent === true;
}

/** Storage path for a CV: always under the caller's folder, never a public URL. */
const cvStoragePath = (userId: string, filename: string) => {
  const ext = filename.match(/\.pdf$/i) ? '.pdf' : '.pdf';
  const name = `${crypto.randomUUID()}${ext}`;
  return `${userId}/${name}`;
};

/**
 * Upload a consenting user's CV into the private `cvs` bucket and record the candidate.
 * Two independent writes: the storage object and the candidate row. If the insert fails
 * after a successful upload the orphan object is harmless but should be pruned by a later
 * card; we still surface the failure so the user can retry.
 */
export async function submitConsentIntake(args: {
  consent: boolean;
  source: 'storage';
  file: File;
  userId: string;
}): Promise<IntakeResult> {
  if (!validConsent(args.consent)) {
    return { ok: false, error: 'You must consent before your CV can be processed.' };
  }

  if (args.file.size > MAX_CV_BYTES) {
    return { ok: false, error: 'The CV must be 2 MB or smaller.' };
  }

  const supabase = await createClient();

  const path = cvStoragePath(args.userId, args.file.name);

  const { error: uploadError } = await supabase.storage
    .from('cvs')
    .upload(path, args.file, { upsert: false });
  if (uploadError) {
    return { ok: false, error: `Upload failed: ${uploadError.message}` };
  }

  const { error: insertError } = await supabase.from('candidates').insert({
    user_id: args.userId,
    consent_at: new Date().toISOString(),
    cv_source: 'storage',
    cv_path: path,
  });
  if (insertError) {
    return { ok: false, error: `Could not record your consent: ${insertError.message}` };
  }

  return { ok: true };
}

/**
 * Consent given over a CV already in the talent Drive root. This path needs no storage
 * upload: the file stays in Drive, referenced by `cv_drive_file_id` (M9).
 */
export async function pickDriveCv(args: {
  consent: boolean;
  driveFileId: string;
  userId: string;
}): Promise<IntakeResult> {
  if (!validConsent(args.consent)) {
    return { ok: false, error: 'You must consent before your CV can be processed.' };
  }

  const supabase = await createClient();

  const { error: insertError } = await supabase.from('candidates').insert({
    user_id: args.userId,
    consent_at: new Date().toISOString(),
    cv_source: 'drive',
    cv_drive_file_id: args.driveFileId,
  });
  if (insertError) {
    return { ok: false, error: `Could not record your consent: ${insertError.message}` };
  }

  return { ok: true };
}