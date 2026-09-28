'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import type { RouteTourConfig, TourContextValue } from '../types';
import { getTourForRoute } from '../config/routes-tour';

const STORAGE_PREFIX = 'p3md_tour_seen_';

const TourContext = React.createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/dashboard/overview';
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [activeTour, setActiveTour] = React.useState<RouteTourConfig>(() =>
    getTourForRoute(pathname),
  );

  // Update active tour whenever route changes
  React.useEffect(() => {
    const tour = getTourForRoute(pathname);
    setActiveTour(tour);
    setCurrentStepIndex(0);

    // Auto-prompt on first visit to this feature route
    if (typeof window !== 'undefined') {
      const storageKey = `${STORAGE_PREFIX}${tour.routePrefix}`;
      const hasSeen = localStorage.getItem(storageKey);

      if (!hasSeen && pathname.startsWith('/dashboard')) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname]);

  const hasSeenCurrentTour = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const storageKey = `${STORAGE_PREFIX}${activeTour.routePrefix}`;
    return Boolean(localStorage.getItem(storageKey));
  }, [activeTour]);

  const startTour = React.useCallback(
    (routeOverride?: string) => {
      const tour = routeOverride
        ? getTourForRoute(routeOverride)
        : getTourForRoute(pathname);
      setActiveTour(tour);
      setCurrentStepIndex(0);
      setIsOpen(true);
    },
    [pathname],
  );

  const nextStep = React.useCallback(() => {
    setCurrentStepIndex((prev) => {
      if (prev < activeTour.steps.length - 1) {
        return prev + 1;
      }
      return prev;
    });
  }, [activeTour]);

  const prevStep = React.useCallback(() => {
    setCurrentStepIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  const goToStep = React.useCallback(
    (stepIndex: number) => {
      if (stepIndex >= 0 && stepIndex < activeTour.steps.length) {
        setCurrentStepIndex(stepIndex);
      }
    },
    [activeTour],
  );

  const closeTour = React.useCallback(
    (dontShowAgain: boolean = true) => {
      setIsOpen(false);
      if (dontShowAgain && typeof window !== 'undefined') {
        const storageKey = `${STORAGE_PREFIX}${activeTour.routePrefix}`;
        localStorage.setItem(storageKey, 'true');
      }
    },
    [activeTour],
  );

  const resetAllTours = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
    }
    startTour();
  }, [startTour]);

  const value: TourContextValue = {
    isOpen,
    currentTour: activeTour,
    currentStepIndex,
    totalSteps: activeTour.steps.length,
    hasSeenCurrentTour,
    startTour,
    nextStep,
    prevStep,
    goToStep,
    closeTour,
    resetAllTours,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const context = React.useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
