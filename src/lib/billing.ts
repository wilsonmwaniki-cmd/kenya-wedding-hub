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
