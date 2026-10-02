import { describe, expect, it } from 'vitest';

import {
  buildProfessionalNetworkChecklist,
  professionalExchangeCategories,
  professionalExchangeUrgencies,
} from '@/lib/professionalNetwork';

describe('buildProfessionalNetworkChecklist', () => {
  it('scores planner readiness from profile signals', () => {
    const checklist = buildProfessionalNetworkChecklist('planner', {
      company_name: 'Atelier Planning',
      bio: 'We design calm luxury wedding weekends.',
      specialties: ['Diaspora weddings'],
      company_email: 'hello@example.com',
      primary_county: 'Nairobi',
      minimum_budget_kes: 500000,
    });

    expect(checklist.completeCount).toBe(6);
    expect(checklist.totalCount).toBe(6);
    expect(checklist.score).toBe(100);
  });

  it('keeps vendor onboarding intentionally incomplete when the listing is sparse', () => {
    const checklist = buildProfessionalNetworkChecklist(
      'vendor',
      {},
      {
        business_name: 'New Lens Studio',
        description: null,
        email: null,
        phone: null,
        website: null,
        location_county: null,
        service_areas: [],
        services: [],
        minimum_budget_kes: null,
        maximum_budget_kes: null,
      },
    );

    expect(checklist.completeCount).toBe(1);
    expect(checklist.score).toBeLessThan(30);
  });

  it('exposes a stable exchange taxonomy for the professionals forum', () => {
    expect(professionalExchangeCategories).toContain('sourcing');
    expect(professionalExchangeCategories).toContain('emergency');
    expect(professionalExchangeUrgencies).toEqual(['planning', 'this_week', 'event_day']);
  });
});
