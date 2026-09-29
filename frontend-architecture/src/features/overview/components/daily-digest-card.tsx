'use client';

import * as React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import { motionTransition } from '@/components/ui/motion-safe';
import type { DigestRow } from '../types';

interface DailyDigestCardProps {
  digest: DigestRow | null;
}

export function DailyDigestCard({ digest }: DailyDigestCardProps) {
  const reduced = useReducedMotion() ?? false;
  const [expanded, setExpanded] = React.useState(true);
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed || !digest) return null;

  const dateLabel = new Date(digest.created_at).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const timeLabel = new Date(digest.created_at).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const modelName = digest.model.replace(/^anthropic:|^hermes:/, '');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={motionTransition(reduced, { duration: 0.28, ease: [0.16, 1, 0.3, 1] })}
      >
        <Card className='border-primary/20 bg-gradient-to-r from-primary/5 via-card to-card shadow-xs transition-all overflow-hidden'>
          <CardHeader className='pb-3'>
            <div className='flex items-center gap-2'>
              <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                <Icons.sparkles className='h-4 w-4' />
              </div>
              <div>
                <CardTitle className='text-base font-semibold text-foreground'>
                  Daily Digest · {dateLabel}
                </CardTitle>
                <CardDescription className='text-xs'>
                  Generated at {timeLabel} WIB via <Badge variant='outline' className='text-[10px] py-0 px-1 font-mono'>{modelName}</Badge>
                </CardDescription>
              </div>
            </div>

            <CardAction className='flex items-center gap-1.5'>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 px-2 text-xs text-muted-foreground hover:text-foreground'
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <Icons.chevronUp className='mr-1 h-3.5 w-3.5' />
                    Collapse
                  </>
                ) : (
                  <>
                    <Icons.chevronDown className='mr-1 h-3.5 w-3.5' />
                    Expand
                  </>
                )}
              </Button>
              <Button
                variant='ghost'
                size='icon'
                className='h-7 w-7 text-muted-foreground hover:text-foreground'
                onClick={() => setDismissed(true)}
                title='Dismiss briefing'
              >
                <Icons.close className='h-3.5 w-3.5' />
              </Button>
            </CardAction>
          </CardHeader>

          <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ gridTemplateRows: '0fr', opacity: 0 }}
                    animate={{ gridTemplateRows: '1fr', opacity: 1 }}
                    exit={{ gridTemplateRows: '0fr', opacity: 0 }}
                    transition={motionTransition(reduced, { duration: 0.24, ease: [0.16, 1, 0.3, 1] })}
                    className='grid overflow-hidden'
                  >
                    <div className='min-h-0'>
                      <CardContent className='pt-0 pb-4 text-sm'>
                        <div className='rounded-md border bg-muted/20 p-4 font-sans text-xs leading-relaxed space-y-2 whitespace-pre-wrap text-foreground/90'>
                          {digest.content_md}
                        </div>
                      </CardContent>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
            </motion.div>
            </AnimatePresence>
            );
}
