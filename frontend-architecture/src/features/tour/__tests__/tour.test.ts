import { describe, expect, it } from 'bun:test';
import { getTourForRoute, ROUTE_TOURS, DEFAULT_TOUR } from '../config/routes-tour';

describe('Contextual Feature Tour System (PSI-111)', () => {
  it('resolves unique tour configuration for each dashboard route', () => {
    const overviewTour = getTourForRoute('/dashboard/overview');
    expect(overviewTour.featureName).toBe('Overview & Briefing');
    expect(overviewTour.steps.length).toBeGreaterThanOrEqual(3);

    const financeTour = getTourForRoute('/dashboard/finance');
    expect(financeTour.featureName).toBe('Finance Ledger & Budget');
    expect(financeTour.steps.some((s) => s.id === 'finance-add-entry')).toBe(true);

    const kanbanTour = getTourForRoute('/dashboard/kanban');
    expect(kanbanTour.featureName).toBe('Kanban Tasks & Boards');
    expect(kanbanTour.steps.some((s) => s.id === 'kanban-task-details')).toBe(true);

    const calendarTour = getTourForRoute('/dashboard/calendar');
    expect(calendarTour.featureName).toBe('Calendar & Operational Agenda');

    const aiChatTour = getTourForRoute('/dashboard/ai-chat');
    expect(aiChatTour.featureName).toBe('In-App AI Assistant');

    const docsTour = getTourForRoute('/dashboard/documents');
    expect(docsTour.featureName).toBe('Documents & Google Drive');

    const talentTour = getTourForRoute('/dashboard/talent');
    expect(talentTour.featureName).toBe('Talent & Candidate Search');

    const settingsTour = getTourForRoute('/dashboard/settings');
    expect(settingsTour.featureName).toBe('Settings & Connected Apps');
  });

  it('falls back to default tour for unmatched routes', () => {
    const fallbackTour = getTourForRoute('/dashboard/unknown-module');
    expect(fallbackTour.featureName).toBe(DEFAULT_TOUR.featureName);
    expect(fallbackTour.steps.length).toBe(3);
  });

  it('validates every tour config has required fields and non-empty steps', () => {
    const allTours = [...ROUTE_TOURS, DEFAULT_TOUR];

    for (const tour of allTours) {
      expect(tour.routePrefix).toBeDefined();
      expect(tour.featureName.length).toBeGreaterThan(0);
      expect(tour.summary.length).toBeGreaterThan(0);
      expect(tour.steps.length).toBeGreaterThanOrEqual(2);

      for (const step of tour.steps) {
        expect(step.id).toBeDefined();
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.description.length).toBeGreaterThan(0);
      }
    }
  });
});
