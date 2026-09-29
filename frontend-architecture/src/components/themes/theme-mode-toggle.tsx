'use client';

import { Icons } from '@/components/icons';
import { useTheme } from 'next-themes';
import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { startThemeTransition } from '@/lib/theme-transition';
import { EASE_OUT } from '@/components/ui/motion-safe';

export function ThemeModeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const reduced = useReducedMotion() ?? false;
  // Avoid rendering a theme-dependent icon before hydration settles resolvedTheme.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const handleThemeToggle = React.useCallback(
    (e?: React.MouseEvent) => {
      const newMode = resolvedTheme === 'dark' ? 'light' : 'dark';
      // Circular reveal from the click point (falls back to center for the
      // keyboard shortcut, which passes no event).
      startThemeTransition(() => setTheme(newMode), e);
    },
    [resolvedTheme, setTheme]
  );

  // Cmd/Ctrl+Shift+D toggles the theme; kbar separately handles the 'D D' sequence
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'd' || !e.shiftKey || !(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      handleThemeToggle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleThemeToggle]);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant='secondary'
            size='icon'
            className='group/toggle size-8'
            onClick={handleThemeToggle}
          />
        }
      >
        {mounted ? (
          <AnimatePresence mode='wait' initial={false}>
            <motion.span
              key={isDark ? 'moon' : 'sun'}
              className='inline-flex'
              initial={reduced ? false : { rotate: -90, scale: 0.4, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={reduced ? undefined : { rotate: 90, scale: 0.4, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.25, ease: EASE_OUT }}
            >
              {isDark ? <Icons.moon /> : <Icons.sun />}
            </motion.span>
          </AnimatePresence>
        ) : (
          <Icons.brightness />
        )}
        <span className='sr-only'>Toggle theme</span>
      </TooltipTrigger>
      <TooltipContent>
        Toggle theme <Kbd>⌘⇧D</Kbd> <Kbd>D D</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
