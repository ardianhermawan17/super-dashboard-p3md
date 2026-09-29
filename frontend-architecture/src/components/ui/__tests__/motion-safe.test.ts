import { describe, expect, it } from 'bun:test';
import {
  fadeRiseItem,
  motionTransition,
  staggerContainer,
  tapPhysics,
} from '../motion-safe';

describe('Motion Accessibility & Token Guardrails (PSI-112)', () => {
  it('collapses staggerContainer to static opacity under reduced motion', () => {
    const normal = staggerContainer(false, 0.08, 0.1);
    expect(normal.hidden).toEqual({ opacity: 0 });
    expect(normal.show).toEqual({
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    });

    const reduced = staggerContainer(true, 0.08, 0.1);
    expect(reduced.hidden).toEqual({ opacity: 1 });
    expect(reduced.show).toEqual({ opacity: 1 });
  });

  it('collapses fadeRiseItem to instant static state under reduced motion', () => {
    const normal = fadeRiseItem(false, 14, 0.35);
    expect(normal.hidden).toEqual({ opacity: 0, y: 14, scale: 0.98 });
    expect(normal.show).toHaveProperty('opacity', 1);
    expect(normal.show).toHaveProperty('y', 0);

    const reduced = fadeRiseItem(true, 14, 0.35);
    expect(reduced.hidden).toEqual({ opacity: 1 });
    expect(reduced.show).toEqual({ opacity: 1 });
  });

  it('suppresses hover and tap physics when user prefers reduced motion', () => {
    const normal = tapPhysics(false, -2, 0.98);
    expect(normal).toHaveProperty('whileHover', { y: -2, scale: 1.008 });
    expect(normal).toHaveProperty('whileTap', { scale: 0.98 });

    const reduced = tapPhysics(true, -2, 0.98);
    expect(reduced).toEqual({});
  });

  it('collapses motionTransition duration to 0 under reduced motion', () => {
    const original = { duration: 0.28, ease: 'easeOut' };
    const reduced = motionTransition(true, original);
    expect(reduced).toEqual({ duration: 0 });

    const normal = motionTransition(false, original);
    expect(normal).toEqual(original);
  });
});
