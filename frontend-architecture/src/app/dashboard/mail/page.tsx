import * as React from 'react';
import { redirect } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { getSession } from '@/lib/auth/session';
import { getMailInboxData } from '@/features/mail/actions';
import { MailInboxView } from '@/features/mail/components/mail-inbox-view';

export const metadata = {
  title: 'Role & Group Mail | P3MD Social'
};

export default async function MailPage() {
  const session = await getSession();
  if (!session) {
    redirect('/auth/sign-in');
  }
  const { threads } = await getMailInboxData();

  return (
    <PageContainer
      pageTitle='Role & Group Mail'
      pageDescription='Inbox and dispatch logs for messages targeted to roles and groups.'
    >
      <MailInboxView threads={threads} />
    </PageContainer>
  );
}
