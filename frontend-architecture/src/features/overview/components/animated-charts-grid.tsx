'use client';

import * as React from 'react';
import { motion } from 'motion/react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.99 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.38,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

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
