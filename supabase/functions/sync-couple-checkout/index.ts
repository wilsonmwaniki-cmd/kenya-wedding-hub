import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type CouplePlanTier = 'basic' | 'premium';
type BundleType = 'wedding_pass' | 'registry_addon' | 'guest_rsvp_addon';

type CheckoutMapping = {
  bundleCode: string;
  bundleType: BundleType;
  features: string[];
  couplePlanTier: CouplePlanTier | null;
  seatLimits: { committee: number; family: number } | null;
  syncLegacyPlanningPass: boolean;
};

const checkoutMap: Record<string, CheckoutMapping> = {
  planning_pass_one_time: {
    bundleCode: 'planning_pass_one_time',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
      'timeline_management',
      'ai_wedding_assistant',
    ],
    couplePlanTier: 'premium',
    seatLimits: { committee: 20, family: 20 },
    syncLegacyPlanningPass: true,
  },
  couple_basic_monthly: {
    bundleCode: 'couple_basic_monthly',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
    ],
    couplePlanTier: 'basic',
    seatLimits: { committee: 10, family: 10 },
    syncLegacyPlanningPass: false,
  },
  couple_basic_annual: {
    bundleCode: 'couple_basic_annual',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
    ],
    couplePlanTier: 'basic',
    seatLimits: { committee: 10, family: 10 },
    syncLegacyPlanningPass: false,
  },
  couple_premium_monthly: {
    bundleCode: 'couple_premium_monthly',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
      'timeline_management',
      'ai_wedding_assistant',
    ],
    couplePlanTier: 'premium',
    seatLimits: { committee: 20, family: 20 },
    syncLegacyPlanningPass: true,
  },
  couple_premium_annual: {
    bundleCode: 'couple_premium_annual',
    bundleType: 'wedding_pass',
    features: [
      'wedding_collaboration',
      'planner_collaboration',
      'vendor_collaboration',
      'committee_collaboration',
      'family_collaboration',
      'timeline_management',
      'ai_wedding_assistant',
    ],
    couplePlanTier: 'premium',
    seatLimits: { committee: 20, family: 20 },
    syncLegacyPlanningPass: true,
  },
  gift_registry_addon: {
    bundleCode: 'gift_registry_addon',
    bundleType: 'registry_addon',
    features: ['gift_registry'],
    couplePlanTier: null,
    seatLimits: null,
    syncLegacyPlanningPass: false,
  },
  guest_rsvp_management_addon: {
    bundleCode: 'guest_rsvp_management_addon',
    bundleType: 'guest_rsvp_addon',
    features: ['guest_rsvp_management'],
    couplePlanTier: null,
    seatLimits: null,
    syncLegacyPlanningPass: false,
  },
};

function toIsoOrNull(timestamp?: number | null) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}

function resolveBundleStatus(subscriptionStatus: Stripe.Subscription.Status | null) {
  if (subscriptionStatus === 'past_due' || subscriptionStatus === 'unpaid') return 'grace';
  if (subscriptionStatus === 'canceled' || subscriptionStatus === 'incomplete_expired') return 'cancelled';
  return 'active';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'Checkout sync environment variables are not fully configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing Stripe checkout session id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20',
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'You must be signed in before checkout sync can run.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const entitlementCode = session.metadata?.entitlement_code;
    const checkoutUserId = session.metadata?.user_id;
    const checkoutAudience = session.metadata?.audience;
    const weddingId = session.metadata?.wedding_id;

    if (checkoutUserId !== user.id) {
      return new Response(JSON.stringify({ error: 'This checkout session does not belong to the current user.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (checkoutAudience !== 'couple') {
      return new Response(JSON.stringify({ error: 'This checkout session is not for a couple wedding upgrade.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!weddingId) {
      return new Response(JSON.stringify({ error: 'This checkout session is missing a wedding workspace reference.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.status !== 'complete') {
      return new Response(JSON.stringify({ error: 'Stripe checkout is not complete yet.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mapping = entitlementCode ? checkoutMap[entitlementCode] : null;
    if (!mapping) {
      return new Response(JSON.stringify({ error: 'This checkout session is not a supported couple plan or add-on.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: membership, error: membershipError } = await serviceClient
      .from('wedding_memberships')
      .select('id, role, is_owner, membership_status')
      .eq('wedding_id', weddingId)
      .eq('user_id', user.id)
      .eq('membership_status', 'active')
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: 'You must still be an active owner of this wedding to activate the upgrade.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const canManageWedding =
      membership.is_owner === true ||
      membership.role === 'bride' ||
      membership.role === 'groom';

    if (!canManageWedding) {
      return new Response(JSON.stringify({ error: 'Only wedding owners can activate couple plans and add-ons.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
    const stripeSubscription = subscriptionId
      ? await stripe.subscriptions.retrieve(subscriptionId)
      : null;

    const bundleStatus = resolveBundleStatus(stripeSubscription?.status ?? null);
    const activatedAt = session.created ? new Date(session.created * 1000).toISOString() : new Date().toISOString();
    const expiresAt = toIsoOrNull(stripeSubscription?.current_period_end ?? null);
    const graceEndsAt = bundleStatus === 'grace' ? expiresAt : null;
    const billingCycle = entitlementCode?.endsWith('_monthly')
      ? 'monthly'
      : entitlementCode?.endsWith('_annual')
        ? 'annual'
        : 'one_time';

    const { data: existingBundles, error: existingBundleError } = await serviceClient
      .from('wedding_subscription_bundles')
      .select('id, metadata, seat_limit')
      .eq('wedding_id', weddingId)
      .eq('bundle_code', mapping.bundleCode)
      .eq('bundle_type', mapping.bundleType)
      .order('created_at', { ascending: false })
      .limit(1);

    if (existingBundleError) throw existingBundleError;

    const existingBundle = existingBundles?.[0] ?? null;

    const bundlePayload = {
      id: existingBundle?.id,
      wedding_id: weddingId,
      bundle_code: mapping.bundleCode,
      bundle_type: mapping.bundleType,
      status: bundleStatus,
      billing_cycle: billingCycle,
      seat_limit: mapping.seatLimits?.committee ?? existingBundle?.seat_limit ?? null,
      activated_at: activatedAt,
      expires_at: expiresAt,
      grace_ends_at: graceEndsAt,
      billing_provider: 'stripe',
      billing_reference: subscriptionId ?? session.id,
      metadata: {
        checkout_session_id: session.id,
        customer_id: customerId,
        subscription_id: subscriptionId,
        entitlement_code: entitlementCode,
        couple_plan_tier: mapping.couplePlanTier,
        committee_seat_limit: mapping.seatLimits?.committee ?? null,
        family_seat_limit: mapping.seatLimits?.family ?? null,
      },
    };

    const { data: bundleRows, error: bundleError } = await serviceClient
      .from('wedding_subscription_bundles')
      .upsert(bundlePayload, {
        onConflict: 'id',
      })
      .select('id')
      .limit(1);

    if (bundleError) throw bundleError;

    const sourceBundleId = bundleRows?.[0]?.id;
    if (!sourceBundleId) {
      throw new Error('The wedding bundle could not be persisted.');
    }

    const entitlementWrites = await Promise.all(
      mapping.features.map(async (featureKey) => {
        const { error } = await serviceClient
          .from('wedding_entitlements')
          .upsert(
            {
              wedding_id: weddingId,
              feature_key: featureKey,
              status: 'active',
              source_bundle_id: sourceBundleId,
              effective_from: activatedAt,
              effective_to: expiresAt,
              metadata: {
                checkout_session_id: session.id,
                entitlement_code: entitlementCode,
              },
            },
            {
              onConflict: 'wedding_id,feature_key',
            },
          );

        if (error) throw error;
        return featureKey;
      }),
    );

    if (mapping.syncLegacyPlanningPass) {
      const { data: ownerMemberships, error: ownerMembershipError } = await serviceClient
        .from('wedding_memberships')
        .select('user_id')
        .eq('wedding_id', weddingId)
        .eq('is_owner', true)
        .eq('membership_status', 'active')
        .in('role', ['bride', 'groom']);

      if (ownerMembershipError) throw ownerMembershipError;

      const ownerUserIds = (ownerMemberships ?? [])
        .map((row: { user_id: string | null }) => row.user_id)
        .filter((value: string | null): value is string => Boolean(value));

      if (ownerUserIds.length > 0) {
        const { error: planningPassUpdateError } = await serviceClient
          .from('profiles')
          .update({
            planning_pass_status: 'active',
            planning_pass_started_at: activatedAt,
            planning_pass_expires_at: expiresAt,
          })
          .in('user_id', ownerUserIds);

        if (planningPassUpdateError) throw planningPassUpdateError;
      }
    }

    return new Response(
      JSON.stringify({
        weddingId,
        bundleCode: mapping.bundleCode,
        bundleType: mapping.bundleType,
        activatedFeatures: entitlementWrites,
        couplePlanTier: mapping.couplePlanTier,
        seatLimits: mapping.seatLimits,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('sync-couple-checkout error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
