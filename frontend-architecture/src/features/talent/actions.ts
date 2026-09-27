'use server';

import { getSession } from '@/lib/auth/session';
import { pickDriveCv, submitConsentIntake, type IntakeResult } from './intake';

/**
 * Server actions for consent + CV intake (PSI-081).
 *
 * These exist for one reason: `userId` comes from the verified session, never from the
 * client. The rules themselves live in `./intake.ts` where they are unit-tested.
 */

const NO_SESSION: IntakeResult = { ok: false, error: 'Please sign in and try again.' };

export async function submitCvAction(form: {
  consent: boolean;
  file: File;
}): Promise<IntakeResult> {
  const session = await getSession();
  if (!session) return NO_SESSION;

  return submitConsentIntake({
    consent: form.consent,
    source: 'storage',
    file: form.file,
    userId: session.userId,
  });
}

export async function pickDriveCvAction(form: {
  consent: boolean;
  driveFileId: string;
}): Promise<IntakeResult> {
  const session = await getSession();
  if (!session) return NO_SESSION;

  return pickDriveCv({
    consent: form.consent,
    driveFileId: form.driveFileId,
    userId: session.userId,
  });
}