import * as React from 'react';
import Link from 'next/link';
import { Icons } from '@/components/icons';

export default function AuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className='relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-muted/30'>
      <div className='w-full max-w-md space-y-6'>
        <div className='flex items-center justify-center gap-2 mb-2'>
          <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm'>
            <Icons.logo className='h-5 w-5' />
          </div>
          <Link href='/' className='text-xl font-bold tracking-tight'>
            P3MD Social
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
