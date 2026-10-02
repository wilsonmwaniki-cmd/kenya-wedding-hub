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
      'ai_wedding_assistant',
      'payments_send',
    ]);
  });
});

describe('professional pricing model', () => {
  it.each([
    { audience: 'planner' as const, monthlyPriceKes: 1500 },
    { audience: 'vendor' as const, monthlyPriceKes: 850 },
  ])('offers Free and Professional to $audience accounts', ({ audience, monthlyPriceKes }) => {
    const free = getProfessionalPlanDefinitionWithContent(audience, 'free');
    const professional = getProfessionalPlanDefinitionWithContent(audience, 'premium');

    expect(free.title).toBe('Free');
    expect(free.includedFeatures).toContain('Standalone quotes, invoices, receipts, and contracts');
    expect(professional).toMatchObject({
      title: 'Professional',
      monthlyPriceKes,
      annualPriceKes: audience === 'planner' ? 15000 : 9000,
    });
    expect(professional.includedFeatures.some((feature) => feature.startsWith('Connect documents'))).toBe(true);
  });

  it('uses Professional for business operations without selling trust or advertising', () => {
    expect(professionalPlanEntitlementMap.premium).toEqual([
      'booking_management',
      'document_collaboration',
      'media_portfolio',
      'payments_accept',
    ]);
  });
});
