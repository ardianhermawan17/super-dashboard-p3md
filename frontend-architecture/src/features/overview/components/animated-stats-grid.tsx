'use client';

import * as React from 'react';
import { motion } from 'motion/react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.32,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

export function AnimatedStatsGrid({ children }: { children: React.ReactNode }) {
  // Convert children to array to animate each card individually
  const items = React.Children.toArray(children);

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
          whileHover={{ y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
          className='h-full'
        >
          {item}
        </motion.div>
      ))}
    </motion.div>
  );
}
