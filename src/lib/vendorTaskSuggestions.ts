import { supabase } from '@/integrations/supabase/client';

export type VendorTaskSuggestionStatus = 'pending' | 'accepted' | 'dismissed';

export interface VendorTaskSuggestion {
  id: string;
  wedding_id: string;
  vendor_id: string;
  created_by_user_id: string;
  title: string;
  description: string | null;
  suggested_due_date: string | null;
  status: VendorTaskSuggestionStatus;
  accepted_task_id: string | null;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listVendorTaskSuggestions(vendorId: string) {
  const { data, error } = await supabase
    .from('workspace_vendor_task_suggestions')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as VendorTaskSuggestion[];
}

export async function createVendorTaskSuggestion(input: {
  vendorId: string;
  title: string;
  description?: string | null;
  suggestedDueDate?: string | null;
}) {
  const { data, error } = await supabase.rpc('create_vendor_workspace_task_suggestion', {
    target_vendor_id: input.vendorId,
    title_input: input.title,
    description_input: input.description ?? null,
    suggested_due_date_input: input.suggestedDueDate || null,
  });

  if (error) throw error;
  return data as VendorTaskSuggestion;
}

export async function acceptVendorTaskSuggestion(suggestionId: string) {
  const { data, error } = await supabase.rpc('accept_vendor_workspace_task_suggestion', {
    target_suggestion_id: suggestionId,
  });

  if (error) throw error;
  return data as VendorTaskSuggestion;
}

export async function dismissVendorTaskSuggestion(suggestionId: string) {
  const { data, error } = await supabase.rpc('dismiss_vendor_workspace_task_suggestion', {
    target_suggestion_id: suggestionId,
  });

  if (error) throw error;
  return data as VendorTaskSuggestion;
}
