'use client';

import type { Transition, Variants } from 'motion/react';

/**
 * Shared motion tokens for the dashboard.
 *
 * Every animation in the app MUST route through these helpers so that the
 * mandatory `prefers-reduced-motion` guardrail cannot be forgotten at a call
 * site: pass the result of `useReducedMotion()` (from motion/react) as
 * `reduced` and the helper collapses the animation to an instant, static state.
 */

/** Standard easing curve used across the dashboard (expo-out). */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** Container that staggers its children on entry. Collapses to no stagger. */
export function staggerContainer(reduced: boolean, stagger = 0.07, delay = 0.05): Variants {
  if (reduced) return { hidden: { opacity: 1 }, show: { opacity: 1 } };
  return {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: stagger, delayChildren: delay } },
  };
}

/** Child that fades/rises into view. Collapses to static, fully visible. */
export function fadeRiseItem(reduced: boolean, y = 12, duration = 0.32): Variants {
  if (reduced) return { hidden: { opacity: 1 }, show: { opacity: 1 } };
  return {
    hidden: { opacity: 0, y, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration, ease: EASE_OUT } },
  };
}

/** Hover/tap physics for interactive cards. Returns `{}` under reduced motion. */
export function tapPhysics(reduced: boolean, hoverY = -1.5, tapScale = 0.985) {
  if (reduced) return {};
  return {
    whileHover: { y: hoverY, scale: 1.008 },
    whileTap: { scale: tapScale },
    transition: { duration: 0.15, ease: 'easeOut' as const },
  };
}

/** A single transition, or `{ duration: 0 }` when motion is reduced. */
export function motionTransition(reduced: boolean, transition: Transition): Transition {
  return reduced ? { duration: 0 } : transition;
}
