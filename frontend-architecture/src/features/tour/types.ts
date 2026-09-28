export interface TourStep {
  id: string;
  title: string;
  description: string;
  badge?: string;
  actionHint?: string;
  targetSelector?: string;
}

export interface RouteTourConfig {
  routePrefix: string;
  featureName: string;
  icon: string;
  summary: string;
  steps: TourStep[];
}

export interface TourContextValue {
  isOpen: boolean;
  currentTour: RouteTourConfig | null;
  currentStepIndex: number;
  totalSteps: number;
  hasSeenCurrentTour: boolean;
  startTour: (routeOverride?: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (stepIndex: number) => void;
  closeTour: (dontShowAgain?: boolean) => void;
  resetAllTours: () => void;
}
