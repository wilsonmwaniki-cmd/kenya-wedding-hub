import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  AbuseProtectionError,
  assertRecentFunctionEventLimit,
} from '../_shared/abuseProtection.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { createCorsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

type GuestRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  wedding_id: string | null;
  name: string;
  checked_in: boolean;
  checked_in_at: string | null;
};

type GuestCheckInEventRow = {
  id: string;
  action: 'check_in' | 'undo_check_in';
  created_at: string;
  guest_id: string;
  wedding_id: string;
};

async function resolveGuestWeddingId(
  adminClient: ReturnType<typeof createClient>,
  guest: GuestRow,
) {
  if (guest.client_id) {
    const { data: plannerClientData } = await adminClient
      .from('planner_clients')
      .select('wedding_id')
      .eq('id', guest.client_id)
      .maybeSingle();

    if (plannerClientData?.wedding_id) {
      return plannerClientData.wedding_id as string;
    }
  }

  const { data: ownerMembershipData } = await adminClient
    .from('wedding_memberships')
    .select('wedding_id')
    .eq('user_id', guest.user_id)
    .eq('is_owner', true)
    .eq('membership_status', 'active')
    .order('accepted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ownerMembershipData?.wedding_id) {
    return ownerMembershipData.wedding_id as string;
  }

  const { data: createdWeddingData } = await adminClient
    .from('weddings')
    .select('id')
    .eq('created_by_user_id', guest.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (createdWeddingData?.id as string | undefined) ?? null;
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Supabase auth configuration is missing' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const user = authData.user;

  try {
    const { guestId, weddingId, action, idempotencyKey, deviceId } = await req.json();

    if (!guestId || typeof guestId !== 'string') {
      return jsonResponse({ error: 'guestId is required' }, 400);
    }

    if (action !== 'check_in' && action !== 'undo_check_in') {
      return jsonResponse({ error: 'A valid action is required.' }, 400);
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8) {
      return jsonResponse({ error: 'A valid idempotency key is required.' }, 400);
    }

    if (deviceId && typeof deviceId !== 'string') {
      return jsonResponse({ error: 'deviceId must be a string when provided.' }, 400);
    }

    await assertRecentFunctionEventLimit(adminClient, {
      functionName: 'guest-check-in',
      userId: user.id,
      eventType: 'guest_check_in_requested',
      lookbackMs: 5 * 60 * 1000,
      maxAttempts: 240,
      retryAfterStrategy: 'window',
      message: (retryAfterSeconds) =>
        `Too many guest check-in actions were sent too quickly. Please wait ${retryAfterSeconds ?? 60} seconds and try again.`,
    });

    const { data: guestData, error: guestError } = await authClient
      .from('guests')
      .select('id, user_id, client_id, wedding_id, name, checked_in, checked_in_at')
      .eq('id', guestId)
      .maybeSingle();

    const guest = guestData as GuestRow | null;

    if (guestError || !guest) {
      return jsonResponse(
        { error: 'Guest not found or you do not have access to this guest.' },
        404,
      );
    }

    let resolvedWeddingId = guest.wedding_id;

    if (!resolvedWeddingId) {
      resolvedWeddingId = await resolveGuestWeddingId(adminClient, guest);
      if (resolvedWeddingId) {
        await adminClient
          .from('guests')
          .update({ wedding_id: resolvedWeddingId })
          .eq('id', guest.id);
      }
    }

    if (!resolvedWeddingId) {
      return jsonResponse(
        { error: 'This guest is not attached to a wedding workspace yet.' },
        409,
      );
    }

    if (weddingId && weddingId !== resolvedWeddingId) {
      return jsonResponse(
        { error: 'This guest does not belong to the requested wedding workspace.' },
        409,
      );
    }

    const desiredCheckedIn = action === 'check_in';
    if (guest.checked_in === desiredCheckedIn) {
      return jsonResponse({
        success: true,
        guestId: guest.id,
        weddingId: resolvedWeddingId,
        action,
        checkedIn: guest.checked_in,
        checkedInAt: guest.checked_in_at,
        idempotent: true,
        requestId,
      });
    }

    await logFunctionEvent({
      functionName: 'guest-check-in',
      severity: 'info',
      status: 'success',
      eventType: 'guest_check_in_requested',
      message: `Guest ${action.replace('_', ' ')} requested.`,
      userId: user.id,
      entityId: guest.id,
      requestId,
      details: {
        guestId: guest.id,
        weddingId: resolvedWeddingId,
        action,
      },
    });

    const nowIso = new Date().toISOString();

    try {
      const { error: eventInsertError } = await adminClient
        .from('guest_check_in_events')
        .insert({
          wedding_id: resolvedWeddingId,
          guest_id: guest.id,
          action,
          performed_by_user_id: user.id,
          performed_by_device_id: deviceId?.trim() || null,
          idempotency_key: idempotencyKey.trim(),
          source: 'app',
          metadata: {
            requestId,
            previousCheckedIn: guest.checked_in,
            previousCheckedInAt: guest.checked_in_at,
          },
        });

      if (eventInsertError) {
        if (eventInsertError.code === '23505') {
          const { data: existingEventData } = await adminClient
            .from('guest_check_in_events')
            .select('id, action, created_at, guest_id, wedding_id')
            .eq('wedding_id', resolvedWeddingId)
            .eq('idempotency_key', idempotencyKey.trim())
            .maybeSingle();

          const { data: latestGuestData } = await adminClient
            .from('guests')
            .select('checked_in, checked_in_at')
            .eq('id', guest.id)
            .maybeSingle();

          const existingEvent = existingEventData as GuestCheckInEventRow | null;

          return jsonResponse({
            success: true,
            guestId: guest.id,
            weddingId: resolvedWeddingId,
            action: existingEvent?.action ?? action,
            checkedIn: latestGuestData?.checked_in ?? desiredCheckedIn,
            checkedInAt: latestGuestData?.checked_in_at ?? (desiredCheckedIn ? nowIso : null),
            idempotent: true,
            requestId,
          });
        }

        throw eventInsertError;
      }
    } catch (eventError) {
      throw eventError;
    }

    const nextCheckedInAt = desiredCheckedIn ? nowIso : null;

    const { error: guestUpdateError } = await adminClient
      .from('guests')
      .update({
        checked_in: desiredCheckedIn,
        checked_in_at: nextCheckedInAt,
      })
      .eq('id', guest.id);

    if (guestUpdateError) {
      throw guestUpdateError;
    }

    await logFunctionEvent({
      functionName: 'guest-check-in',
      severity: 'info',
      status: 'success',
      eventType: desiredCheckedIn ? 'guest_checked_in' : 'guest_check_in_undone',
      message: desiredCheckedIn
        ? `${guest.name} checked in successfully.`
        : `${guest.name} check-in was undone.`,
      userId: user.id,
      entityId: guest.id,
      requestId,
      details: {
        guestId: guest.id,
        weddingId: resolvedWeddingId,
        action,
      },
    });

    return jsonResponse({
      success: true,
      guestId: guest.id,
      weddingId: resolvedWeddingId,
      action,
      checkedIn: desiredCheckedIn,
      checkedInAt: nextCheckedInAt,
      idempotent: false,
      requestId,
    });
  } catch (error) {
    if (error instanceof AbuseProtectionError) {
      await logFunctionEvent({
        functionName: 'guest-check-in',
        severity: 'warn',
        status: 'failure',
        eventType: 'guest_check_in_rate_limited',
        message: error.message,
        userId: user.id,
        requestId,
        details: {
          retryAfterSeconds: error.retryAfterSeconds,
        },
      });

      return new Response(
        JSON.stringify({
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds,
        }),
        {
          status: error.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            ...(error.retryAfterSeconds ? { 'Retry-After': String(error.retryAfterSeconds) } : {}),
          },
        },
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown guest check-in error';

    await logFunctionEvent({
      functionName: 'guest-check-in',
      severity: 'error',
      status: 'failure',
      eventType: 'guest_check_in_failed',
      message,
      userId: user.id,
      requestId,
    });

    console.error('guest-check-in failed:', error);
    return jsonResponse({ error: message }, 500);
  }
});
