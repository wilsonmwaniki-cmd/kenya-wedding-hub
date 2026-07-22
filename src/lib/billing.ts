import { supabase } from '@/integrations/supabase/client';
import { describeBillingError, normalizeInvokeError } from '@/lib/invokeErrors';
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
  reference: string;
  provider?: PaymentProvider;
  sessionId?: string;
  orderTrackingId?: string;
};

export type PaymentProvider = 'pesapal' | 'paystack';

export function getConfiguredPaymentProvider(): PaymentProvider {
  return import.meta.env.VITE_BILLING_PROVIDER === 'paystack' ? 'paystack' : 'pesapal';
}

export type CoupleCheckoutSyncResponse = {
  weddingId: string;
  bundleCode: string;
  bundleType: string;
  activatedFeatures: string[];
  couplePlanTier: 'free' | 'collaborative' | null;
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

export function getCheckoutReferenceFromSearchParams(searchParams: URLSearchParams) {
  return searchParams.get('reference')
    || searchParams.get('trxref')
    || searchParams.get('OrderTrackingId')
    || searchParams.get('checkout_session_id');
}

export function getCheckoutProviderFromSearchParams(searchParams: URLSearchParams): PaymentProvider {
  const provider = searchParams.get('payment_provider');
  return provider === 'paystack' || provider === 'pesapal'
    ? provider
    : getConfiguredPaymentProvider();
}

export async function startCheckout({
  audience,
  feature,
  lookupKey,
  successPath,
  cancelPath,
  cadence,
  weddingId,
}: StartCheckoutArgs) {
  const origin = window.location.origin;
  const successUrl = new URL(successPath, 'https://zania.local');
  successUrl.searchParams.delete('checkout_session_id');
  const provider = getConfiguredPaymentProvider();

  const { data, error } = await supabase.functions.invoke<CheckoutResponse>(`create-${provider}-checkout`, {
    body: {
      audience,
      feature,
      lookupKey,
      cadence,
      weddingId,
      successUrl: new URL(`${successUrl.pathname}${successUrl.search}${successUrl.hash}`, origin).toString(),
      cancelUrl: new URL(cancelPath, origin).toString(),
    },
  });

  if (error) {
    const normalized = await normalizeInvokeError(error, 'Could not start checkout.');
    throw new Error(describeBillingError('checkout_start', normalized.statusCode, normalized.message));
  }

  if (!data?.url) {
    throw new Error('Checkout URL was not returned.');
  }

  window.location.assign(data.url);
}

export async function syncCoupleCheckout(reference: string, provider: PaymentProvider = getConfiguredPaymentProvider()) {
  const { data, error } = await supabase.functions.invoke<CoupleCheckoutSyncResponse>(`sync-${provider}-couple-checkout`, {
    body: provider === 'paystack' ? { reference } : { orderTrackingId: reference },
  });

  if (error) {
    const normalized = await normalizeInvokeError(error, 'Could not sync checkout.');
    throw new Error(describeBillingError('checkout_sync', normalized.statusCode, normalized.message));
  }

  if (!data) {
    throw new Error('Couple checkout sync did not return a response.');
  }

  return data;
}

export async function syncProfessionalCheckout(
  reference: string,
  audience: Extract<PricingAudience, 'planner' | 'vendor'>,
  provider: PaymentProvider = getConfiguredPaymentProvider(),
) {
  const { data, error } = await supabase.functions.invoke<{
    activatedFeatures: string[];
    seatLimit: number | null;
  }>(`sync-${provider}-professional-checkout`, {
    body: provider === 'paystack' ? { reference, audience } : { orderTrackingId: reference, audience },
  });

  if (error) {
    const normalized = await normalizeInvokeError(error, 'Could not sync checkout.');
    throw new Error(describeBillingError('checkout_sync', normalized.statusCode, normalized.message));
  }

  if (!data) {
    throw new Error('Professional checkout sync did not return a response.');
  }

  return data;
}
