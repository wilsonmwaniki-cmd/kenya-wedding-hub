import { supabase } from '@/integrations/supabase/client';

export async function ensureMyCollaborationCode() {
  const { data, error } = await supabase.rpc('ensure_my_collaboration_code');
  if (error) throw error;
  return data as string;
}

export async function requestPlannerLinkByCode(code: string, note?: string) {
  const { data, error } = await supabase.rpc('request_planner_link_by_code', {
    collaboration_code_input: code,
    note: note?.trim() ? note.trim() : null,
  });
  if (error) throw error;
  return data as { status: string; request_id?: string; couple_name?: string; client_id?: string };
}

export async function approvePlannerCodeLinkRequest(requestId: string) {
  const { data, error } = await supabase.rpc('approve_planner_code_link_request', {
    request_id_input: requestId,
  });
  if (error) throw error;
  return data as string | null;
}

export async function rejectPlannerCodeLinkRequest(requestId: string) {
  const { error } = await supabase.rpc('reject_planner_code_link_request', {
    request_id_input: requestId,
  });
  if (error) throw error;
}
