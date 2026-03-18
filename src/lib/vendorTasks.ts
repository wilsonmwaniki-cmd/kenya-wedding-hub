import { supabase } from '@/integrations/supabase/client';
import { getVendorWorkflowTemplates, type WeddingTaskPhase } from '@/lib/weddingTaskTemplates';

export interface VendorTaskInsert {
  userId: string;
  title: string;
  dueDate?: string | null;
  assignedTo?: string | null;
  description?: string | null;
  category?: string | null;
  clientId?: string | null;
  sourceVendorId?: string | null;
  phase?: WeddingTaskPhase | null;
  visibility?: string;
  delegatable?: boolean;
  recommendedRole?: string | null;
  priorityLevel?: number | null;
  templateSource?: string | null;
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
      phase: input.phase ?? null,
      visibility: input.visibility ?? 'public',
      delegatable: input.delegatable ?? false,
      recommended_role: input.recommendedRole ?? null,
      priority_level: input.priorityLevel ?? null,
      template_source: input.templateSource ?? null,
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
  paymentDueDate?: string | null;
}

export async function createVendorTaskBundle(input: VendorTaskBundleInput) {
  const milestoneContent: Record<WeddingTaskPhase, { title: string; description: string; dueDate?: string | null }> = {
    foundation: {
      title: `Capture planning notes for ${input.vendorName}`,
      description: `Record the basic details needed to work with ${input.vendorName}.`,
      dueDate: null,
    },
    research: {
      title: `${input.vendorName}: review quote and shortlist fit`,
      description: `Review ${input.vendorName}'s offer, compare quality and pricing, and decide whether this option stays in the active shortlist.`,
      dueDate: null,
    },
    selection_booking: {
      title: `${input.vendorName}: confirm booking and contract`,
      description: `Lock the scope, confirm the contract terms, and complete the booking steps for ${input.vendorName}.`,
      dueDate: null,
    },
    second_payment: {
      title: `${input.vendorName}: make second payment and review service details`,
      description: `Make the next scheduled payment to ${input.vendorName} and confirm any details that affect service delivery.`,
      dueDate: input.paymentDueDate ?? null,
    },
    closure_final_payment: {
      title: `${input.vendorName}: final confirmation and balance closure`,
      description: `Confirm final timing, close the outstanding balance, and make sure ${input.vendorName} is aligned with the wedding-day schedule.`,
      dueDate: input.paymentDueDate ?? null,
    },
  };

  const workflowTemplates = getVendorWorkflowTemplates(input.category);

  const { data: existingTasks, error: existingError } = await supabase
    .from('tasks')
    .select('title, phase')
    .eq('source_vendor_id', input.vendorId);

  if (existingError) throw existingError;

  const existingTitles = new Set((existingTasks ?? []).map((task) => task.title));
  const existingPhases = new Set((existingTasks ?? []).map((task) => task.phase).filter(Boolean));
  const inserts = workflowTemplates
    .filter((template) => !existingPhases.has(template.phase))
    .map((template) => {
      const content = milestoneContent[template.phase];
      return {
        user_id: input.userId,
        title: content.title,
        due_date: content.dueDate ?? null,
        description: content.description,
        client_id: input.clientId || null,
        category: input.category,
        source_vendor_id: input.vendorId,
        phase: template.phase,
        visibility: template.visibility,
        delegatable: template.delegatable,
        recommended_role: template.recommendedRole,
        priority_level: template.priorityLevel,
        template_source: 'vendor_milestone_bundle_v1',
      };
    })
    .filter((task) => !existingTitles.has(task.title))
    .map((task) => ({
      user_id: input.userId,
      ...task,
    }));

  if (!inserts.length) return [];

  const { data, error } = await supabase.from('tasks').insert(inserts).select();
  if (error) throw error;
  return data ?? [];
}
