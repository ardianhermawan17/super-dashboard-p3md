'use client';

import * as React from 'react';
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/**
 * AnimatedNumber - Spring-physics driven metric counter.
 * Falls back to the final value directly when the user prefers reduced motion.
 */
export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: AnimatedNumberProps) {
  const reduced = useReducedMotion() ?? false;
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
    if (reduced) {
      spring.jump(value);
    } else {
      spring.set(value);
    }
  }, [spring, value, reduced]);

  return <motion.span className={className}>{display}</motion.span>;
}
