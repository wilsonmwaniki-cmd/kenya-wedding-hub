import { supabase } from '@/integrations/supabase/client';

export interface VendorTaskInsert {
  userId: string;
  title: string;
  dueDate?: string | null;
  assignedTo?: string | null;
  description?: string | null;
  category?: string | null;
  clientId?: string | null;
  sourceVendorId?: string | null;
}

export async function createVendorTask(input: VendorTaskInsert) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: input.userId,
      title: input.title,
      due_date: input.dueDate || null,
      assigned_to: input.assignedTo || null,
      description: input.description || null,
      category: input.category || null,
      client_id: input.clientId || null,
      source_vendor_id: input.sourceVendorId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

interface VendorTaskBundleInput {
  userId: string;
  vendorId: string;
  vendorName: string;
  category: string;
  clientId?: string | null;
}

export async function createVendorTaskBundle(input: VendorTaskBundleInput) {
  const bundle = [
    `Confirm contract with ${input.vendorName}`,
    `Pay deposit to ${input.vendorName}`,
    `Share brief and expectations with ${input.vendorName}`,
    `Confirm final schedule with ${input.vendorName}`,
    `Pay final balance to ${input.vendorName}`,
  ];

  const { data: existingTasks, error: existingError } = await supabase
    .from('tasks')
    .select('title')
    .eq('source_vendor_id', input.vendorId);

  if (existingError) throw existingError;

  const existingTitles = new Set((existingTasks ?? []).map((task) => task.title));
  const inserts = bundle
    .filter((title) => !existingTitles.has(title))
    .map((title) => ({
      user_id: input.userId,
      title,
      client_id: input.clientId || null,
      category: input.category,
      source_vendor_id: input.vendorId,
    }));

  if (!inserts.length) return [];

  const { data, error } = await supabase.from('tasks').insert(inserts).select();
  if (error) throw error;
  return data ?? [];
}
