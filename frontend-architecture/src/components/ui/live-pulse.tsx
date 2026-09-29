'use client';

import * as React from 'react';
import { motion } from 'motion/react';

export function LivePulseBadge({ label = 'System Live' }: { label?: string }) {
  return (
    <div className='inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400'>
      <span className='relative flex size-2'>
        <motion.span
          animate={{
            scale: [1, 2.2, 1],
            opacity: [0.75, 0, 0.75],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className='absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75'
        />
        <span className='relative inline-flex size-2 rounded-full bg-emerald-500' />
      </span>
      <span>{label}</span>
    </div>
  );
}
