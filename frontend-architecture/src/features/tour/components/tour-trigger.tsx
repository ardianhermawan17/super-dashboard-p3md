'use client';

import * as React from 'react';
import { useTour } from '../context/tour-context';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

export function TourTrigger() {
  const { currentTour, startTour, resetAllTours, hasSeenCurrentTour } = useTour();
  const [open, setOpen] = React.useState(false);

  if (!currentTour) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            className='relative h-8 w-8 text-muted-foreground hover:text-foreground'
            title={`Take ${currentTour.featureName} Tour`}
            aria-label='Take Feature Tour'
          />
        }
      >
        <Icons.help className='h-4 w-4' />
        {!hasSeenCurrentTour && (
          <span className='absolute top-1.5 right-1.5 flex h-2 w-2'>
            <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75' />
            <span className='relative inline-flex rounded-full h-2 w-2 bg-primary' />
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align='end' className='w-80 p-4 space-y-3'>
        <div className='flex items-start justify-between gap-2'>
          <div className='space-y-1'>
            <div className='flex items-center gap-1.5'>
              <h4 className='font-semibold text-sm leading-none'>
                {currentTour.featureName}
              </h4>
              <Badge variant='outline' className='text-[10px] py-0 px-1 font-normal'>
                {currentTour.steps.length} steps
              </Badge>
            </div>
            <p className='text-xs text-muted-foreground leading-relaxed pt-1'>
              {currentTour.summary}
            </p>
          </div>
        </div>

        <div className='space-y-2 pt-1 border-t'>
          <Button
            size='sm'
            className='w-full text-xs font-semibold gap-1.5'
            onClick={() => {
              setOpen(false);
              startTour();
            }}
          >
            <Icons.sparkles className='h-3.5 w-3.5' />
            Take Tour
          </Button>

          <Button
            variant='ghost'
            size='sm'
            className='w-full text-[11px] h-7 text-muted-foreground hover:text-foreground'
            onClick={() => {
              setOpen(false);
              resetAllTours();
            }}
          >
            Reset all feature tours
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
