'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';
import { resolveConsentState, signInUrlForConsent } from './consent-lib';

/**
 * OAuth 2.1 consent page (PSI-074).
 *
 * Flow (spec: docs/backend-architecture/auth-and-onboarding.md):
 * 1. The OAuth client (e.g. Claude Desktop) redirects here with `?authorization_id=...`.
 * 2. Not signed in -> `/auth/sign-in?next=/auth/consent?authorization_id=...`, back here after login.
 * 3. Reads the request via `supabase.auth.oauth.getAuthorizationDetails`.
 * 4. Already consented -> redirect straight to the client URL (auto-approve rule).
 * 5. Needs consent -> show client + requested scopes, Approve / Deny.
 */
export default function ConsentPage() {
  return (
    <React.Suspense>
      <ConsentForm />
    </React.Suspense>
  );
}

function ConsentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authorizationId = searchParams.get('authorization_id');

  const [sessionChecked, setSessionChecked] = React.useState(false);
  const [state, setState] = React.useState<ReturnType<typeof resolveConsentState> | null>(null);
  const [busy, setBusy] = React.useState(false);
  const startedRef = React.useRef(false);

  // Session gate + (when signed in) load the authorization details exactly once.
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      setSessionChecked(true);

      if (!user) {
        // Not signed in: send to sign-in and come back to this exact request after login.
        router.replace(signInUrlForConsent(authorizationId));
        return;
      }

      if (!authorizationId) {
        setState({ kind: 'error', error: 'This authorization request has no authorization ID.' });
        return;
      }

      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      setState(
        resolveConsentState({
          data,
          error: error ? { message: error.message } : null,
        }),
      );
    });
  }, [authorizationId, router]);

  // Gate: not signed in yet -> send to sign-in, back here after.
  if (!sessionChecked) {
    return (
      <Card className='w-full'>
        <CardContent className='flex items-center justify-center py-8'>
          <span className='animate-pulse text-sm text-muted-foreground'>Checking your session...</span>
        </CardContent>
      </Card>
    );
  }

  if (state === null) {
    // Still resolving the authorization request (session checked, request loading).
    return (
      <Card className='w-full'>
        <CardContent className='flex items-center justify-center py-8'>
          <span className='animate-pulse text-sm text-muted-foreground'>Loading authorization request...</span>
        </CardContent>
      </Card>
    );
  }

  if (state?.kind === 'auto_redirect') {
    // Already approved this client -> send straight back with the code (spec: auto-approve).
    router.replace(state.redirectUrl);
    return null;
  }

  if (state?.kind === 'error') {
    return (
      <Card className='w-full'>
        <CardHeader>
          <CardTitle className='text-2xl'>Consent unavailable</CardTitle>
          <CardDescription>We could not load this authorization request.</CardDescription>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>{state.error}</CardContent>
        <CardFooter className='flex gap-3'>
          <Button onClick={() => router.push('/dashboard/overview')}>Go to dashboard</Button>
          <Button onClick={() => router.push('/')} variant='outline'>
            Home
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const consent = state as Extract<typeof state, { kind: 'consent_required' }>;

  const handleDecision = async (approve: boolean) => {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    try {
      const res = approve
        ? await supabase.auth.oauth.approveAuthorization(consent.authorizationId, {
            skipBrowserRedirect: true,
          })
        : await supabase.auth.oauth.denyAuthorization(consent.authorizationId, {
            skipBrowserRedirect: true,
          });

      if (res.error) {
        toast.error(res.error.message);
        setBusy(false);
        return;
      }

      if (res.data?.redirect_url) {
        router.replace(res.data.redirect_url);
      } else {
        toast.success(approve ? 'Access granted' : 'Request denied');
        router.push('/dashboard/overview');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not process your decision');
      setBusy(false);
    }
  };

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl flex items-center gap-2'>
          <Avatar className='h-6 w-6 rounded-full'>
            {consent.client.logo_uri ? (
              <AvatarImage src={consent.client.logo_uri} alt={`${consent.client.name} logo`} />
            ) : null}
            <AvatarFallback className='text-xs'>
              {consent.client.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span>{consent.client.name}</span>
        </CardTitle>
        <CardDescription>
          wants access to your P3MD account
          {consent.user.email ? (
            <span className='block text-muted-foreground text-xs'>Signed in as {consent.user.email}</span>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-4'>
        <p className='text-sm text-muted-foreground'>
          <span className='font-medium text-foreground'>{consent.client.name}</span> is requesting
          the following permissions:
        </p>

        <ul className='space-y-2'>
          {consent.scopes.map((s) => (
            <li key={s.scope} className='flex items-start gap-2 text-sm'>
              <IconsCheck className='mt-0.5 h-4 w-4 text-primary shrink-0' />
              <div>
                <span className='font-medium'>{s.label}</span>
                <span className='block text-xs text-muted-foreground'>{s.detail}</span>
              </div>
            </li>
          ))}
          {consent.scopes.length === 0 && (
            <li className='text-sm text-muted-foreground'>
              No specific permissions were requested. You can still approve or deny this connection.
            </li>
          )}
        </ul>

        {consent.client.uri && (
          <p className='text-xs text-muted-foreground'>
            Learn more about this app at{' '}
            <a
              href={consent.client.uri}
              target='_blank'
              rel='noreferrer'
              className='text-primary underline underline-offset-2'
            >
              {consent.client.uri}
            </a>
            . You can revoke this access later from Connected apps.
          </p>
        )}
      </CardContent>

      <CardFooter className='flex gap-3'>
        <Button onClick={() => handleDecision(false)} variant='outline' disabled={busy}>
          Deny
        </Button>
        <Button onClick={() => handleDecision(true)} disabled={busy}>
          {busy ? 'Processing...' : 'Approve'}
        </Button>
      </CardFooter>
    </Card>
  );
}

function IconsCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      {...props}
    >
      <path d='M20 6 9 17l-5-5' />
    </svg>
  );
}