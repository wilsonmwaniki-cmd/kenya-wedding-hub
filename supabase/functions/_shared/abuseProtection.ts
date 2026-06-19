import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export class AbuseProtectionError extends Error {
  status: number;
  retryAfterSeconds: number | null;

  constructor(message: string, status = 429, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'AbuseProtectionError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function assertMaxLength(value: string | null | undefined, maxLength: number, label: string) {
  if (!value) return;
  if (value.length > maxLength) {
    throw new AbuseProtectionError(`${label} is too long.`, 400);
  }
}

export function assertMessageCount(value: unknown, maxMessages: number) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AbuseProtectionError('At least one message is required.', 400);
  }

  if (value.length > maxMessages) {
    throw new AbuseProtectionError(`Too many messages were included in this request.`, 400);
  }
}

export function getRetryAfterSeconds(lastAttemptAt: string | null | undefined, cooldownMs: number) {
  if (!lastAttemptAt) return 0;

  const elapsedMs = Date.now() - new Date(lastAttemptAt).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs >= cooldownMs) return 0;

  return Math.ceil((cooldownMs - elapsedMs) / 1000);
}

export async function countRecentFunctionEvents(
  adminClient: SupabaseClient,
  options: {
    functionName: string;
    userId: string;
    eventType?: string;
    audience?: string;
    entityId?: string;
    lookbackMs: number;
  },
) {
  const threshold = new Date(Date.now() - options.lookbackMs).toISOString();

  let query = adminClient
    .from('function_event_logs')
    .select('id', { count: 'exact', head: true })
    .eq('function_name', options.functionName)
    .eq('user_id', options.userId)
    .gte('created_at', threshold);

  if (options.eventType) {
    query = query.eq('event_type', options.eventType);
  }

  if (options.audience) {
    query = query.eq('audience', options.audience);
  }

  if (options.entityId) {
    query = query.eq('entity_id', options.entityId);
  }

  const { count, error } = await query;

  if (error) {
    console.error('countRecentFunctionEvents failed:', error);
    return null;
  }

  return count ?? 0;
}

async function getRecentFunctionEventTimestamps(
  adminClient: SupabaseClient,
  options: {
    functionName: string;
    userId: string;
    eventType?: string;
    audience?: string;
    entityId?: string;
    lookbackMs: number;
  },
  limit: number,
) {
  const threshold = new Date(Date.now() - options.lookbackMs).toISOString();

  let query = adminClient
    .from('function_event_logs')
    .select('created_at')
    .eq('function_name', options.functionName)
    .eq('user_id', options.userId)
    .gte('created_at', threshold)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (options.eventType) {
    query = query.eq('event_type', options.eventType);
  }

  if (options.audience) {
    query = query.eq('audience', options.audience);
  }

  if (options.entityId) {
    query = query.eq('entity_id', options.entityId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getRecentFunctionEventTimestamps failed:', error);
    return null;
  }

  return data ?? [];
}

export async function assertRecentFunctionEventLimit(
  adminClient: SupabaseClient,
  options: {
    functionName: string;
    userId: string;
    eventType?: string;
    audience?: string;
    entityId?: string;
    lookbackMs: number;
    maxAttempts: number;
    message: string | ((retryAfterSeconds: number | null) => string);
    retryAfterSeconds?: number | null;
    retryAfterStrategy?: 'fixed' | 'window';
  },
) {
  const resolveMessage = (retryAfterSeconds: number | null) =>
    typeof options.message === 'function' ? options.message(retryAfterSeconds) : options.message;

  if (options.retryAfterStrategy === 'window') {
    const recentEvents = await getRecentFunctionEventTimestamps(adminClient, options, options.maxAttempts);
    if (recentEvents === null) return;

    if (recentEvents.length >= options.maxAttempts) {
      const oldestCreatedAt = recentEvents[0]?.created_at;
      const rollingRetryAfterSeconds =
        oldestCreatedAt && typeof oldestCreatedAt === 'string'
          ? getRetryAfterSeconds(oldestCreatedAt, options.lookbackMs)
          : 0;
      const retryAfterSeconds =
        rollingRetryAfterSeconds > 0
          ? rollingRetryAfterSeconds
          : options.retryAfterSeconds ?? Math.ceil(options.lookbackMs / 1000);

      throw new AbuseProtectionError(
        resolveMessage(retryAfterSeconds),
        429,
        retryAfterSeconds,
      );
    }

    return;
  }

  const recentCount = await countRecentFunctionEvents(adminClient, options);
  if (recentCount === null) return;

  if (recentCount >= options.maxAttempts) {
    throw new AbuseProtectionError(
      resolveMessage(options.retryAfterSeconds ?? Math.ceil(options.lookbackMs / 1000)),
      429,
      options.retryAfterSeconds ?? Math.ceil(options.lookbackMs / 1000),
    );
  }
}
