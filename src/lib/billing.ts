import { supabase } from '@/integrations/supabase/client';
import type { PricingAudience, PricingCheckoutCadence } from '@/lib/pricingPlans';

type StartCheckoutArgs = {
  audience: PricingAudience;
  feature?: string | null;
  lookupKey: string;
  successPath: string;
  cancelPath: string;
  cadence: PricingCheckoutCadence;
  weddingId?: string | null;
};

type CheckoutResponse = {
  url: string;
  sessionId: string;
};

export type CoupleCheckoutSyncResponse = {
  weddingId: string;
  bundleCode: string;
  bundleType: string;
  activatedFeatures: string[];
  couplePlanTier: 'free' | 'basic' | 'premium' | null;
  seatLimits: {
    committee: number;
    family: number;
  } | null;
};

export function withCheckoutSessionId(successPath: string) {
  const url = new URL(successPath, 'https://zania.local');
  url.searchParams.set('checkout_session_id', '{CHECKOUT_SESSION_ID}');
  return `${url.pathname}${url.search}${url.hash}`;
}

export async function startStripeCheckout({
  audience,
  feature,
  lookupKey,
  successPath,
  cancelPath,
  cadence,
  weddingId,
}: StartCheckoutArgs) {
  const origin = window.location.origin;

  const { data, error } = await supabase.functions.invoke<CheckoutResponse>('create-stripe-checkout', {
    body: {
      audience,
      feature,
      lookupKey,
      cadence,
      weddingId,
      successUrl: new URL(successPath, origin).toString(),
      cancelUrl: new URL(cancelPath, origin).toString(),
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error('Stripe checkout URL was not returned.');
  }

  window.location.assign(data.url);
}

export async function syncCoupleCheckout(sessionId: string) {
  const { data, error } = await supabase.functions.invoke<CoupleCheckoutSyncResponse>('sync-couple-checkout', {
    body: {
      sessionId,
    },
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Couple checkout sync did not return a response.');
  }

  return data;
}
