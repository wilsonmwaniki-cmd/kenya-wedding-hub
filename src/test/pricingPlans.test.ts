import { describe, expect, it } from 'vitest';

import {
  listCouplePlanDefinitions,
  getProfessionalPlanDefinitionWithContent,
} from '@/lib/pricingContent';
import { couplePlanEntitlementMap, professionalPlanEntitlementMap } from '@/lib/pricingPlans';

describe('couple pricing model', () => {
  it('offers only Intimate and Collaborative', () => {
    const plans = listCouplePlanDefinitions();

    expect(plans.map((plan) => plan.tier)).toEqual(['free', 'collaborative']);
    expect(plans[0].title).toBe('Intimate');
    expect(plans[1]).toMatchObject({
      title: 'Collaborative',
      monthlyPriceKes: 1999,
      annualPriceKes: 15000,
      checkoutMonthlyLookupKey: 'couple_collaborative_monthly',
      checkoutAnnualLookupKey: 'couple_collaborative_annual',
    });
  });

  it('uses the paid plan only for collaboration entitlements and future releases', () => {
    expect(couplePlanEntitlementMap.collaborative).toEqual([
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
    ]);
  });
});

describe('professional pricing model', () => {
  it.each(['planner', 'vendor'] as const)('offers Free and Professional to %s accounts', (audience) => {
    const free = getProfessionalPlanDefinitionWithContent(audience, 'free');
    const professional = getProfessionalPlanDefinitionWithContent(audience, 'premium');

    expect(free.title).toBe('Free');
    expect(free.includedFeatures).toContain('Collaborate in couple-funded workspaces');
    expect(professional).toMatchObject({
      title: 'Professional',
      monthlyPriceKes: 1000,
      annualPriceKes: 9000,
    });
  });

  it('uses Professional for business operations without selling trust or advertising', () => {
    expect(professionalPlanEntitlementMap.premium).toEqual([
      'booking_management',
      'invoicing',
      'contract_management',
      'media_portfolio',
    ]);
  });
});
