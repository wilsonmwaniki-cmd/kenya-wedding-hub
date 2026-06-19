import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type RuntimeLogSeverity = 'info' | 'warn' | 'error';
type RuntimeLogStatus = 'success' | 'failure';

interface RuntimeLogEntry {
  functionName: string;
  severity: RuntimeLogSeverity;
  status: RuntimeLogStatus;
  eventType: string;
  message: string;
  userId?: string | null;
  audience?: string | null;
  entityId?: string | null;
  requestId?: string | null;
  details?: Record<string, unknown> | null;
}

export async function logFunctionEvent(entry: RuntimeLogEntry) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) return;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    await adminClient.from('function_event_logs').insert({
      function_name: entry.functionName,
      severity: entry.severity,
      status: entry.status,
      event_type: entry.eventType,
      message: entry.message,
      user_id: entry.userId ?? null,
      audience: entry.audience ?? null,
      entity_id: entry.entityId ?? null,
      request_id: entry.requestId ?? null,
      details: entry.details ?? {},
    });
  } catch (error) {
    console.error('runtime logger failed:', error);
  }
}
