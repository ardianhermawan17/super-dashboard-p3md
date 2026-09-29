'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { fadeRiseItem, staggerContainer } from '@/components/ui/motion-safe';

interface AnimatedChartsGridProps {
  barStats: React.ReactNode;
  sales: React.ReactNode;
  areaStats: React.ReactNode;
  pieStats: React.ReactNode;
}

export function AnimatedChartsGrid({
  barStats,
  sales,
  areaStats,
  pieStats,
}: AnimatedChartsGridProps) {
  const reduced = useReducedMotion() ?? false;
  const containerVariants = staggerContainer(reduced, 0.09, 0.15);
  const itemVariants = fadeRiseItem(reduced, 16, 0.38);

  return (
    <motion.div
      variants={containerVariants}
      initial='hidden'
      animate='show'
      className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'
    >
      <motion.div variants={itemVariants} className='col-span-4'>
        {barStats}
      </motion.div>
      <motion.div variants={itemVariants} className='col-span-4 md:col-span-3'>
        {sales}
      </motion.div>
      <motion.div variants={itemVariants} className='col-span-4'>
        {areaStats}
      </motion.div>
      <motion.div variants={itemVariants} className='col-span-4 md:col-span-3'>
        {pieStats}
      </motion.div>
    </motion.div>
  );
}