'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAppForm } from '@/lib/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from '@/components/icons';

const signUpSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

type SignUpValues = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [submittedEmail, setSubmittedEmail] = React.useState('');

  const form = useAppForm({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: ''
    } as SignUpValues,
    validators: {
      onSubmit: signUpSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMsg(null);
      const { data, error } = await supabase.auth.signUp({
        email: value.email,
        password: value.password,
        options: {
          data: {
            full_name: value.fullName
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm`
        }
      });

      if (error) {
        setErrorMsg(error.message);
        toast.error(error.message);
        return;
      }

      if (data.session) {
        toast.success('Account created successfully');
        router.push('/dashboard/overview');
        router.refresh();
      } else {
        setSubmittedEmail(value.email);
        setIsSubmitted(true);
      }
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
            We&apos;ve sent a confirmation link to <span className='font-medium text-foreground'>{submittedEmail}</span>.
            Click the link in the email to activate your account.
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
        <CardTitle className='text-2xl'>Create an account</CardTitle>
        <CardDescription>
          Enter your details below to create your account
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
            name='fullName'
            children={(field) => (
              <field.TextField
                label='Full Name'
                placeholder='John Doe'
                required
                autoComplete='name'
              />
            )}
          />

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
              <field.TextField
                label='Password'
                type='password'
                placeholder='••••••••'
                required
                autoComplete='new-password'
              />
            )}
          />

          <form.AppField
            name='confirmPassword'
            children={(field) => (
              <field.TextField
                label='Confirm Password'
                type='password'
                placeholder='••••••••'
                required
                autoComplete='new-password'
              />
            )}
          />
        </CardContent>
        <CardFooter className='flex flex-col gap-4 mt-2'>
          <form.SubmitButton className='w-full'>
            Create account
          </form.SubmitButton>
          <div className='text-center text-sm text-muted-foreground'>
            Already have an account?{' '}
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
