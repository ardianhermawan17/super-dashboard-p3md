'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAppForm } from '@/lib/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

type SignInValues = z.infer<typeof signInSchema>;

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard/overview';
  const supabase = createClient();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      email: '',
      password: ''
    } as SignInValues,
    validators: {
      onSubmit: signInSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMsg(null);
      const { error } = await supabase.auth.signInWithPassword({
        email: value.email,
        password: value.password
      });

      if (error) {
        setErrorMsg(error.message);
        toast.error(error.message);
        return;
      }

      toast.success('Signed in successfully');
      router.push(next);
      router.refresh();
    }
  });

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl'>Sign in</CardTitle>
        <CardDescription>
          Enter your email and password to access your account
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

          <form.AppField
            name='password'
            children={(field) => (
              <div className='space-y-1'>
                <div className='flex items-center justify-between'>
                  <span />
                  <Link
                    href='/auth/forgot-password'
                    className='text-xs text-muted-foreground hover:text-primary transition-colors'
                  >
                    Forgot password?
                  </Link>
                </div>
                <field.TextField
                  label='Password'
                  type='password'
                  placeholder='••••••••'
                  required
                  autoComplete='current-password'
                />
              </div>
            )}
          />
        </CardContent>
        <CardFooter className='flex flex-col gap-4 mt-2'>
          <form.SubmitButton className='w-full'>
            Sign in
          </form.SubmitButton>
          <div className='text-center text-sm text-muted-foreground'>
            Don&apos;t have an account?{' '}
            <Link
              href='/auth/sign-up'
              className='font-medium text-primary hover:underline underline-offset-4'
            >
              Sign up
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
