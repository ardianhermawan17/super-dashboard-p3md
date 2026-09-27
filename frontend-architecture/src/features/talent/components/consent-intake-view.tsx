'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { FileUploader } from '@/components/file-uploader';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { pickDriveCvAction, submitCvAction } from '../actions';

/**
 * Consent and CV intake (PSI-081).
 *
 * Consent first — the checkbox gates every path, and the server refuses without it too
 * (`candidates.consent_at` is `not null`; "no consent, no row"). Two sources, per the spec:
 * a PDF into the private `cvs` bucket, or a CV already in the talent Drive root.
 */
export function ConsentIntakeView({ driveFileId }: { driveFileId?: string }) {
  const [consented, setConsented] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const onUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setBusy(true);
    const result = await submitCvAction({ consent: consented, file });
    setBusy(false);

    if (result.ok) {
      toast.success('CV received. We will process it shortly.');
    } else {
      toast.error(result.error);
    }
  };

  const onPickDrive = async () => {
    // `driveFileId` is handed to this view by the documents module when a user picks a CV
    // from the talent Drive root (PSI-064 wires that picker; the intake already accepts it).
    if (!driveFileId) {
      toast.info('Pick a CV from the Drive root to continue.');
      return;
    }

    setBusy(true);
    const result = await pickDriveCvAction({ consent: consented, driveFileId });
    setBusy(false);

    if (result.ok) {
      toast.success('CV linked. We will process it shortly.');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className='grid gap-6 lg:grid-cols-2'>
      <Card>
        <CardHeader>
          <CardTitle>Consent</CardTitle>
          <CardDescription>
            Your CV is personal data. We need your explicit consent before we process it.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex items-start gap-3'>
            <Checkbox
              id='consent'
              checked={consented}
              onCheckedChange={(v) => setConsented(v === true)}
            />
            <Label htmlFor='consent' className='text-sm leading-relaxed font-normal'>
              I consent to my CV being stored and parsed to extract my skills, and I understand I
              can withdraw at any time, which deletes my CV and the data derived from it.
            </Label>
          </div>

          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Icons.lock className='size-3.5' aria-hidden />
            <span>
              Stored in a private bucket, readable only by you. No public link is ever created.
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your CV</CardTitle>
          <CardDescription>Upload a PDF (max 2 MB), or use a CV already in the Drive root.</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <FileUploader
            accept={{ 'application/pdf': ['.pdf'] }}
            maxSize={2 * 1024 * 1024}
            maxFiles={1}
            disabled={!consented || busy}
            onUpload={onUpload}
          />

          <div className='flex items-center gap-3'>
            <span className='text-xs text-muted-foreground'>or</span>
            <Button variant='outline' size='sm' disabled={!consented || busy} onClick={onPickDrive}>
              Use a CV in Drive
            </Button>
          </div>

          {!consented ? (
            <p className='text-xs text-muted-foreground'>
              Tick the consent box to enable upload.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}