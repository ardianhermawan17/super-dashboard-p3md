'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fadeRiseItem, staggerContainer, tapPhysics } from '@/components/ui/motion-safe';

export function AnimatedStatsGrid({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion() ?? false;
  const items = React.Children.toArray(children);
  const containerVariants = staggerContainer(reduced, 0.07, 0.05);
  const itemVariants = fadeRiseItem(reduced, 12, 0.32);

  return (
    <motion.div
      variants={containerVariants}
      initial='hidden'
      animate='show'
      className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4'
    >
      {items.map((item, idx) => (
        <motion.div
          key={idx}
          variants={itemVariants}
          {...(reduced ? {} : { whileHover: { y: -3, transition: { duration: 0.2, ease: 'easeOut' } } })}
          className='h-full'
        >
          {item}
        </motion.div>
      ))}
    </motion.div>
  );
}
