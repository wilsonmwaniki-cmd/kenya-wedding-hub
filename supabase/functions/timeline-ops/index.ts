import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { AbuseProtectionError, assertRecentFunctionEventLimit } from '../_shared/abuseProtection.ts';
import { logFunctionEvent } from '../_shared/runtimeLogger.ts';
import { createCorsHeaders } from '../_shared/cors.ts';
import { assertActiveAuthSession, isAuthSessionError } from '../_shared/sessionGuard.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ??
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
  '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

type TimelineRow = {
  id: string;
  user_id: string;
  client_id: string | null;
  wedding_id: string | null;
  title: string;
};

type TimelineEventRow = {
  id: string;
  timeline_id: string;
  event_time: string;
  title: string;
  description: string | null;
  assigned_people: string[];
  sort_order: number;
  category: string | null;
};

type TimelineOperationEventRow = {
  id: string;
  operation_type: string;
  created_at: string;
};

type TimelineOpsAction =
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'reorder_events'
  | 'shift_events';

async function resolveTimelineWeddingId(
  adminClient: ReturnType<typeof createClient>,
  timeline: TimelineRow,
) {
  if (timeline.client_id) {
    const { data: plannerClientData } = await adminClient
      .from('planner_clients')
      .select('wedding_id')
      .eq('id', timeline.client_id)
      .maybeSingle();

    if (plannerClientData?.wedding_id) {
      return plannerClientData.wedding_id as string;
    }
  }

  const { data: ownerMembershipData } = await adminClient
    .from('wedding_memberships')
    .select('wedding_id')
    .eq('user_id', timeline.user_id)
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
    .eq('created_by_user_id', timeline.user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (createdWeddingData?.id as string | undefined) ?? null;
}

function normalizeAssignedPeople(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeTimeValue(raw: string) {
  const parts = raw.split(':');
  if (parts.length < 2) return null;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

async function upsertShareLinks(
  adminClient: ReturnType<typeof createClient>,
  timelineId: string,
  assignedPeople: string[],
) {
  if (!assignedPeople.length) return;

  const rows = assignedPeople.map((assigneeName) => ({
    timeline_id: timelineId,
    assignee_name: assigneeName,
  }));

  await adminClient
    .from('timeline_share_links')
    .upsert(rows, { onConflict: 'timeline_id,assignee_name', ignoreDuplicates: true });
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
    await assertActiveAuthSession(adminClient, authHeader, user.id);
  } catch (error) {
    if (isAuthSessionError(error)) {
      return jsonResponse({ error: error.message }, error.status);
    }
    throw error;
  }

  try {
    const {
      action,
      timelineId,
      timelineEventId,
      idempotencyKey,
      eventTime,
      title,
      description,
      assignedPeople,
      category,
      sortOrder,
      orderedEventIds,
      shiftMinutes,
    } = await req.json();

    if (!timelineId || typeof timelineId !== 'string') {
      return jsonResponse({ error: 'timelineId is required.' }, 400);
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8) {
      return jsonResponse({ error: 'A valid idempotency key is required.' }, 400);
    }

    if (!['create_event', 'update_event', 'delete_event', 'reorder_events', 'shift_events'].includes(action)) {
      return jsonResponse({ error: 'A valid timeline operation is required.' }, 400);
    }

    await assertRecentFunctionEventLimit(adminClient, {
      functionName: 'timeline-ops',
      userId: user.id,
      eventType: 'timeline_operation_requested',
      lookbackMs: 5 * 60 * 1000,
      maxAttempts: 300,
      retryAfterStrategy: 'window',
      message: (retryAfterSeconds) =>
        `Too many timeline actions were sent too quickly. Please wait ${retryAfterSeconds ?? 60} seconds and try again.`,
    });

    const { data: timelineData, error: timelineError } = await authClient
      .from('timelines')
      .select('id, user_id, client_id, wedding_id, title')
      .eq('id', timelineId)
      .maybeSingle();

    const timeline = timelineData as TimelineRow | null;

    if (timelineError || !timeline) {
      return jsonResponse({ error: 'Timeline not found or you do not have access to it.' }, 404);
    }

    let resolvedWeddingId = timeline.wedding_id;
    if (!resolvedWeddingId) {
      resolvedWeddingId = await resolveTimelineWeddingId(adminClient, timeline);
      if (resolvedWeddingId) {
        await adminClient.from('timelines').update({ wedding_id: resolvedWeddingId }).eq('id', timeline.id);
      }
    }

    if (!resolvedWeddingId) {
      return jsonResponse({ error: 'This timeline is not attached to a wedding workspace yet.' }, 409);
    }

    let existingEvent: TimelineEventRow | null = null;
    if (timelineEventId) {
      const { data: eventData } = await authClient
        .from('timeline_events')
        .select('id, timeline_id, event_time, title, description, assigned_people, sort_order, category')
        .eq('id', timelineEventId)
        .maybeSingle();
      existingEvent = (eventData as TimelineEventRow | null) ?? null;

      if (!existingEvent || existingEvent.timeline_id !== timeline.id) {
        return jsonResponse({ error: 'Timeline event not found for this timeline.' }, 404);
      }
    }

    const trimmedKey = idempotencyKey.trim();
    const nowIso = new Date().toISOString();

    const insertOperationEvent = async (
      operationType: string,
      payload: Record<string, unknown>,
      relatedTimelineEventId: string | null,
    ) => {
      const { error: operationError } = await adminClient
        .from('timeline_operation_events')
        .insert({
          wedding_id: resolvedWeddingId,
          timeline_id: timeline.id,
          timeline_event_id: relatedTimelineEventId,
          operation_type: operationType,
          performed_by_user_id: user.id,
          idempotency_key: trimmedKey,
          payload,
        });

      if (operationError) {
        if (operationError.code === '23505') {
          const { data: existingOperationEventData } = await adminClient
            .from('timeline_operation_events')
            .select('id, operation_type, created_at')
            .eq('timeline_id', timeline.id)
            .eq('idempotency_key', trimmedKey)
            .maybeSingle();

          return {
            duplicated: true,
            existing: (existingOperationEventData as TimelineOperationEventRow | null) ?? null,
          };
        }

        throw operationError;
      }

      return { duplicated: false, existing: null as TimelineOperationEventRow | null };
    };

    await logFunctionEvent({
      functionName: 'timeline-ops',
      severity: 'info',
      status: 'success',
      eventType: 'timeline_operation_requested',
      message: `Timeline operation ${action} requested.`,
      userId: user.id,
      entityId: timeline.id,
      requestId,
      details: {
        action,
        timelineId: timeline.id,
        timelineEventId: timelineEventId ?? null,
        weddingId: resolvedWeddingId,
      },
    });

    if (action === 'create_event') {
      const normalizedTime = typeof eventTime === 'string' ? normalizeTimeValue(eventTime) : null;
      if (!normalizedTime || typeof title !== 'string' || !title.trim()) {
        return jsonResponse({ error: 'A valid event time and title are required.' }, 400);
      }

      const normalizedAssignedPeople = normalizeAssignedPeople(assignedPeople);
      const normalizedSortOrder = Number.isInteger(sortOrder) ? Number(sortOrder) : 0;
      const payload = {
        timeline_id: timeline.id,
        event_time: normalizedTime,
        title: title.trim(),
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        assigned_people: normalizedAssignedPeople,
        category: typeof category === 'string' && category.trim() ? category.trim() : null,
        sort_order: normalizedSortOrder,
      };

      const inserted = await insertOperationEvent('event_created', payload, null);
      if (inserted.duplicated) {
        return jsonResponse({
          success: true,
          timelineId: timeline.id,
          weddingId: resolvedWeddingId,
          action,
          idempotent: true,
          requestId,
        });
      }

      const { data: newEventData, error: insertError } = await adminClient
        .from('timeline_events')
        .insert(payload)
        .select('id, timeline_id, event_time, title, description, assigned_people, sort_order, category')
        .single();

      if (insertError || !newEventData) {
        throw insertError ?? new Error('Failed to create timeline event.');
      }

      await upsertShareLinks(adminClient, timeline.id, normalizedAssignedPeople);

      await logFunctionEvent({
        functionName: 'timeline-ops',
        severity: 'info',
        status: 'success',
        eventType: 'timeline_event_created',
        message: `Created timeline event "${payload.title}".`,
        userId: user.id,
        entityId: newEventData.id,
        requestId,
        details: {
          timelineId: timeline.id,
          weddingId: resolvedWeddingId,
        },
      });

      return jsonResponse({
        success: true,
        timelineId: timeline.id,
        weddingId: resolvedWeddingId,
        action,
        event: newEventData,
        idempotent: false,
        requestId,
      });
    }

    if (action === 'update_event') {
      if (!existingEvent) {
        return jsonResponse({ error: 'timelineEventId is required for updates.' }, 400);
      }

      const normalizedTime = typeof eventTime === 'string' ? normalizeTimeValue(eventTime) : null;
      if (!normalizedTime || typeof title !== 'string' || !title.trim()) {
        return jsonResponse({ error: 'A valid event time and title are required.' }, 400);
      }

      const normalizedAssignedPeople = normalizeAssignedPeople(assignedPeople);
      const payload = {
        timeline_id: timeline.id,
        event_time: normalizedTime,
        title: title.trim(),
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        assigned_people: normalizedAssignedPeople,
        category: typeof category === 'string' && category.trim() ? category.trim() : null,
        sort_order: Number.isInteger(sortOrder) ? Number(sortOrder) : existingEvent.sort_order,
      };

      const inserted = await insertOperationEvent('event_updated', payload, existingEvent.id);
      if (inserted.duplicated) {
        return jsonResponse({
          success: true,
          timelineId: timeline.id,
          weddingId: resolvedWeddingId,
          action,
          eventId: existingEvent.id,
          idempotent: true,
          requestId,
        });
      }

      const { data: updatedEventData, error: updateError } = await adminClient
        .from('timeline_events')
        .update(payload)
        .eq('id', existingEvent.id)
        .select('id, timeline_id, event_time, title, description, assigned_people, sort_order, category')
        .single();

      if (updateError || !updatedEventData) {
        throw updateError ?? new Error('Failed to update timeline event.');
      }

      await upsertShareLinks(adminClient, timeline.id, normalizedAssignedPeople);

      return jsonResponse({
        success: true,
        timelineId: timeline.id,
        weddingId: resolvedWeddingId,
        action,
        event: updatedEventData,
        idempotent: false,
        requestId,
      });
    }

    if (action === 'delete_event') {
      if (!existingEvent) {
        return jsonResponse({ error: 'timelineEventId is required for deletes.' }, 400);
      }

      const inserted = await insertOperationEvent('event_deleted', {
        title: existingEvent.title,
        event_time: existingEvent.event_time,
      }, existingEvent.id);

      if (inserted.duplicated) {
        return jsonResponse({
          success: true,
          timelineId: timeline.id,
          weddingId: resolvedWeddingId,
          action,
          eventId: existingEvent.id,
          idempotent: true,
          requestId,
        });
      }

      const { error: deleteError } = await adminClient
        .from('timeline_events')
        .delete()
        .eq('id', existingEvent.id);

      if (deleteError) {
        throw deleteError;
      }

      return jsonResponse({
        success: true,
        timelineId: timeline.id,
        weddingId: resolvedWeddingId,
        action,
        eventId: existingEvent.id,
        idempotent: false,
        requestId,
      });
    }

    if (action === 'reorder_events') {
      if (!Array.isArray(orderedEventIds) || orderedEventIds.length === 0) {
        return jsonResponse({ error: 'orderedEventIds is required for reordering.' }, 400);
      }

      const normalizedOrderedEventIds = orderedEventIds.filter((value): value is string => typeof value === 'string');
      const { data: timelineEventRows, error: rowsError } = await authClient
        .from('timeline_events')
        .select('id, sort_order')
        .eq('timeline_id', timeline.id);

      if (rowsError) throw rowsError;

      const existingIds = new Set((timelineEventRows ?? []).map((row: any) => row.id));
      if (existingIds.size !== normalizedOrderedEventIds.length || normalizedOrderedEventIds.some((id) => !existingIds.has(id))) {
        return jsonResponse({ error: 'The reordered event list does not match the current timeline.' }, 409);
      }

      const inserted = await insertOperationEvent('event_reordered', {
        ordered_event_ids: normalizedOrderedEventIds,
      }, null);

      if (inserted.duplicated) {
        return jsonResponse({
          success: true,
          timelineId: timeline.id,
          weddingId: resolvedWeddingId,
          action,
          idempotent: true,
          requestId,
        });
      }

      for (let index = 0; index < normalizedOrderedEventIds.length; index += 1) {
        await adminClient
          .from('timeline_events')
          .update({ sort_order: index })
          .eq('id', normalizedOrderedEventIds[index]);
      }

      return jsonResponse({
        success: true,
        timelineId: timeline.id,
        weddingId: resolvedWeddingId,
        action,
        orderedEventIds: normalizedOrderedEventIds,
        idempotent: false,
        requestId,
      });
    }

    if (action === 'shift_events') {
      if (!Number.isInteger(shiftMinutes) || !shiftMinutes) {
        return jsonResponse({ error: 'A non-zero integer shiftMinutes value is required.' }, 400);
      }

      const { data: timelineEventRows, error: rowsError } = await authClient
        .from('timeline_events')
        .select('id, event_time')
        .eq('timeline_id', timeline.id);

      if (rowsError) throw rowsError;

      const inserted = await insertOperationEvent('timeline_shifted', {
        shift_minutes: shiftMinutes,
      }, null);

      if (inserted.duplicated) {
        return jsonResponse({
          success: true,
          timelineId: timeline.id,
          weddingId: resolvedWeddingId,
          action,
          idempotent: true,
          requestId,
        });
      }

      for (const row of timelineEventRows ?? []) {
        const [hours, minutes] = String((row as any).event_time).split(':').map(Number);
        const totalMinutes = Math.max(0, Math.min(23 * 60 + 59, hours * 60 + minutes + Number(shiftMinutes)));
        const nextTime = `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}:00`;
        await adminClient
          .from('timeline_events')
          .update({ event_time: nextTime })
          .eq('id', (row as any).id);
      }

      return jsonResponse({
        success: true,
        timelineId: timeline.id,
        weddingId: resolvedWeddingId,
        action,
        shiftMinutes,
        idempotent: false,
        requestId,
      });
    }

    return jsonResponse({ error: 'Unsupported timeline operation.' }, 400);
  } catch (error) {
    if (error instanceof AbuseProtectionError) {
      await logFunctionEvent({
        functionName: 'timeline-ops',
        severity: 'warn',
        status: 'failure',
        eventType: 'timeline_operation_rate_limited',
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

    const message = error instanceof Error ? error.message : 'Unknown timeline operation error';

    await logFunctionEvent({
      functionName: 'timeline-ops',
      severity: 'error',
      status: 'failure',
      eventType: 'timeline_operation_failed',
      message,
      userId: user.id,
      requestId,
    });

    console.error('timeline-ops failed:', error);
    return jsonResponse({ error: message }, 500);
  }
});
