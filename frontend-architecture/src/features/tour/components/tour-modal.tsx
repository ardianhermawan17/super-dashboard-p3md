'use client';

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useTour } from '../context/tour-context';
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
DialogDescription,
DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { motionTransition } from '@/components/ui/motion-safe';

export function TourModal() {
  const {
    isOpen,
    currentTour,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    goToStep,
    closeTour,
  } = useTour();

  const [dontShowAgain, setDontShowAgain] = React.useState(true);
    const reduced = useReducedMotion() ?? false;

    if (!isOpen || !currentTour) return null;

    const step = currentTour.steps[currentStepIndex];
    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === totalSteps - 1;
    const progressPercent = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' && !isLastStep) {
      e.preventDefault();
      nextStep();
    } else if (e.key === 'ArrowLeft' && !isFirstStep) {
      e.preventDefault();
      prevStep();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeTour(dontShowAgain)}>
      <DialogContent
        className='sm:max-w-md p-0 overflow-hidden border-primary/30 shadow-xl'
        onKeyDown={handleKeyDown}
      >
        {/* Animated Progress line - transform-only (scaleX), never width */}
                <div className='h-1.5 w-full bg-muted/60 overflow-hidden'>
                  <motion.div
                    className='h-full bg-primary origin-left'
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: progressPercent / 100 }}
                    transition={motionTransition(reduced, { type: 'spring', stiffness: 260, damping: 28 })}
                  />
                </div>

        <div className='p-6 space-y-4'>
          <AnimatePresence mode='wait'>
            <motion.div
                          key={step.id}
                          initial={reduced ? { opacity: 1 } : { opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={reduced ? { opacity: 1 } : { opacity: 0, x: -12 }}
                          transition={motionTransition(reduced, { duration: 0.22, ease: 'easeOut' })}
                          className='space-y-4'
                        >
              {/* Header */}
              <DialogHeader className='space-y-1.5'>
                <div className='flex items-center justify-between gap-2'>
                  <Badge variant='outline' className='text-xs font-semibold py-0.5 px-2 text-primary border-primary/30 bg-primary/5'>
                    {currentTour.featureName} · Step {currentStepIndex + 1} of {totalSteps}
                  </Badge>
                  {step.badge && (
                    <Badge variant='secondary' className='text-[10px] py-0 px-1.5'>
                      {step.badge}
                    </Badge>
                  )}
                </div>

                <DialogTitle className='text-lg font-bold tracking-tight text-foreground pt-1'>
                  {step.title}
                </DialogTitle>

                <DialogDescription className='text-sm text-muted-foreground leading-relaxed pt-1'>
                  {step.description}
                </DialogDescription>
              </DialogHeader>

              {/* Action Hint / Tip callout */}
                    {step.actionHint && (
                      <motion.div
                        initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={motionTransition(reduced, { delay: 0.08, duration: 0.2 })}
                        className='rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs flex items-start gap-2.5 text-foreground/90'
                      >
                        <Icons.sparkles className='h-4 w-4 text-primary shrink-0 mt-0.5' />
                        <span>{step.actionHint}</span>
                      </motion.div>
                    )}
                  </motion.div>
                  </AnimatePresence>

                  {/* Step indicator dots - transform-only (scaleX), never width */}
                  <div className='flex items-center justify-center gap-1.5 pt-2'>
                    {currentTour.steps.map((_, idx) => (
                      <button
                        key={idx}
                        type='button'
                        onClick={() => goToStep(idx)}
                        aria-label={`Go to step ${idx + 1}`}
                        className={`h-2 rounded-full transition-transform duration-300 origin-left ${
                          idx === currentStepIndex
                            ? 'w-6 bg-primary shadow-xs'
                            : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                        }`}
                      />
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className='border-t bg-muted/20 px-6 py-3.5 flex sm:justify-between items-center gap-2'>
          <label className='flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              aria-label="Don't auto-show tour again"
              className='rounded border-muted-foreground/40 text-primary focus:ring-primary h-3.5 w-3.5'
            />
            Don&apos;t auto-show again
          </label>

          <div className='flex items-center gap-2 ml-auto'>
            {!isFirstStep && (
              <Button
                variant='outline'
                size='sm'
                onClick={prevStep}
                className='h-8 px-3 text-xs'
              >
                Previous
              </Button>
            )}

            {isLastStep ? (
              <Button
                size='sm'
                onClick={() => closeTour(dontShowAgain)}
                className='h-8 px-4 text-xs bg-primary text-primary-foreground font-semibold shadow-xs'
              >
                Got it!
              </Button>
            ) : (
              <Button
                size='sm'
                onClick={nextStep}
                className='h-8 px-3 text-xs'
              >
                Next
                <Icons.chevronRight className='ml-1 h-3.5 w-3.5' />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
