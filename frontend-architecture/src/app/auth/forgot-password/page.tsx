'use client';

import * as React from 'react';
import Link from 'next/link';
import { z } from 'zod';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAppForm } from '@/lib/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address')
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState('');

  const form = useAppForm({
    defaultValues: {
      email: ''
    } as ForgotPasswordValues,
    validators: {
      onSubmit: forgotPasswordSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMsg(null);
      const { error } = await supabase.auth.resetPasswordForEmail(value.email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset-password`
      });

      if (error) {
        setErrorMsg(error.message);
        toast.error(error.message);
        return;
      }

      setSubmittedEmail(value.email);
      setIsSubmitted(true);
    }
  });

  if (isSubmitted) {
    return (
      <Card className='w-full text-center'>
        <CardHeader>
          <div className='mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary'>
            <Icons.send className='h-6 w-6' />
          </div>
          <CardTitle className='text-2xl'>Check your email</CardTitle>
          <CardDescription>
            We&apos;ve sent a password reset link to <span className='font-medium text-foreground'>{submittedEmail}</span>.
            Follow the instructions in the email to reset your password.
          </CardDescription>
        </CardHeader>
        <CardFooter className='flex justify-center'>
          <Link
            href='/auth/sign-in'
            className='text-sm font-medium text-primary hover:underline underline-offset-4'
          >
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl'>Forgot password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <CardContent className='space-y-4'>
          {errorMsg && (
            <div className='p-3 text-sm rounded-lg bg-destructive/10 text-destructive border border-destructive/20'>
              {errorMsg}
            </div>
          )}

          <form.AppField
            name='email'
            children={(field) => (
              <field.TextField
                label='Email'
                type='email'
                placeholder='name@example.com'
                required
                autoComplete='email'
              />
            )}
          />
        </CardContent>
        <CardFooter className='flex flex-col gap-4 mt-2'>
          <form.SubmitButton className='w-full'>
            Send reset link
          </form.SubmitButton>
          <div className='text-center text-sm text-muted-foreground'>
            Remember your password?{' '}
            <Link
              href='/auth/sign-in'
              className='font-medium text-primary hover:underline underline-offset-4'
            >
              Sign in
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
