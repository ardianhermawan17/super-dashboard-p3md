'use client';

import * as React from 'react';
import { useSpring, useTransform, motion } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/**
 * AnimatedNumber - Spring-physics driven metric counter
 * Grounded in the Von Restorff & Zeigarnik UX principles:
 * Animates key numerical changes to signal freshness and real-time vitality.
 */
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: AnimatedNumberProps) {
  const spring = useSpring(0, {
    mass: 0.8,
    stiffness: 85,
    damping: 20,
  });

  const display = useTransform(spring, (current) => {
    const formatted = current.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${prefix}${formatted}${suffix}`;
  });

  React.useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className={className}>{display}</motion.span>;
}
