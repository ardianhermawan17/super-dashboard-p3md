'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAppForm } from '@/lib/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Please confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      password: '',
      confirmPassword: ''
    } as ResetPasswordValues,
    validators: {
      onSubmit: resetPasswordSchema
    },
    onSubmit: async ({ value }) => {
      setErrorMsg(null);
      const { error } = await supabase.auth.updateUser({
        password: value.password
      });

      if (error) {
        setErrorMsg(error.message);
        toast.error(error.message);
        return;
      }

      toast.success('Password updated successfully');
      router.push('/dashboard/overview');
      router.refresh();
    }
  });

  return (
    <Card className='w-full'>
      <CardHeader>
        <CardTitle className='text-2xl'>Set new password</CardTitle>
        <CardDescription>
          Enter a new password for your account
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
            name='password'
            children={(field) => (
              <field.TextField
                label='New Password'
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
            Update password
          </form.SubmitButton>
          <div className='text-center text-sm text-muted-foreground'>
            <Link
              href='/auth/sign-in'
              className='font-medium text-primary hover:underline underline-offset-4'
            >
              Back to sign in
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
