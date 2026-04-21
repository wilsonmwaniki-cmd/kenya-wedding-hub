import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.25.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const professionalCheckoutMap: Record<
  string,
  {
    features: Array<'media_portfolio' | 'advertising' | 'team_workspace'>;
    seatLimit?: number;
  }
> = {
  media_addon: {
    features: ['media_portfolio'],
  },
  advertising_addon: {
    features: ['advertising'],
  },
  team_workspace_bundle_3: {
    features: ['team_workspace'],
    seatLimit: 3,
  },
  team_workspace_bundle_5: {
    features: ['team_workspace'],
    seatLimit: 5,
  },
  team_workspace_bundle_10: {
    features: ['team_workspace'],
    seatLimit: 10,
  },
};

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

    const { sessionId, audience } = await req.json();

    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing Stripe checkout session id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (audience !== 'planner' && audience !== 'vendor') {
      return new Response(JSON.stringify({ error: 'Invalid professional audience.' }), {
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

    if (checkoutUserId !== user.id) {
      return new Response(JSON.stringify({ error: 'This checkout session does not belong to the current user.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (checkoutAudience !== audience) {
      return new Response(JSON.stringify({ error: 'This checkout session does not match the requested professional audience.' }), {
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

    const mapping = entitlementCode ? professionalCheckoutMap[entitlementCode] : null;
    if (!mapping) {
      return new Response(JSON.stringify({ error: 'This checkout session is not a supported professional add-on.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const entitlementWrites = await Promise.all(
      mapping.features.map(async (featureKey) => {
        const { data: existingRow } = await serviceClient
          .from('professional_entitlements')
          .select('id, seat_limit')
          .eq('user_id', user.id)
          .eq('audience', audience)
          .eq('feature_key', featureKey)
          .maybeSingle();

        const seatLimit = featureKey === 'team_workspace'
          ? Math.max(existingRow?.seat_limit ?? 0, mapping.seatLimit ?? 0)
          : existingRow?.seat_limit ?? null;

        const { error } = await serviceClient
          .from('professional_entitlements')
          .upsert(
            {
              id: existingRow?.id,
              user_id: user.id,
              audience,
              feature_key: featureKey,
              status: 'active',
              source_lookup_key: entitlementCode,
              source_bundle_code: entitlementCode,
              seat_limit: seatLimit,
              effective_from: new Date().toISOString(),
              effective_to: null,
              metadata: {
                checkout_session_id: session.id,
                customer_id: session.customer,
                subscription_id: session.subscription,
              },
            },
            {
              onConflict: 'user_id,audience,feature_key',
            },
          );

        if (error) throw error;
        return featureKey;
      }),
    );

    return new Response(
      JSON.stringify({
        audience,
        activatedFeatures: entitlementWrites,
        seatLimit: mapping.seatLimit ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('sync-professional-checkout error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
