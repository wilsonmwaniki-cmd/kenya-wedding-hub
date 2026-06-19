import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type VendorWorkspaceUpdate = Tables<'workspace_vendor_updates'>;

export const vendorWorkspaceUpdateTypes = [
  'waiting_on_couple',
  'need_approval',
  'on_track',
  'delivered',
  'freeform',
] as const;

export type VendorWorkspaceUpdateType = typeof vendorWorkspaceUpdateTypes[number];

export function vendorWorkspaceUpdateLabel(type: VendorWorkspaceUpdateType | string | null | undefined) {
  switch (type) {
    case 'waiting_on_couple':
      return 'Waiting on couple';
    case 'need_approval':
      return 'Need approval';
    case 'on_track':
      return 'On track';
    case 'delivered':
      return 'Delivered';
    case 'freeform':
      return 'Freeform note';
    default:
      return type || 'Vendor update';
  }
}

export async function listVendorWorkspaceUpdates(vendorId: string) {
  const { data, error } = await supabase
    .from('workspace_vendor_updates')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as VendorWorkspaceUpdate[];
}

export async function createVendorWorkspaceUpdate(input: {
  vendorId: string;
  updateType: VendorWorkspaceUpdateType;
  noteMessage?: string | null;
}) {
  const { data, error } = await (supabase.rpc as any)('create_vendor_workspace_update', {
    target_vendor_id: input.vendorId,
    update_type_input: input.updateType,
    note_message_input: input.noteMessage ?? null,
  });

  if (error) throw error;
  return data as VendorWorkspaceUpdate;
}

export async function archiveVendorWorkspaceUpdate(updateId: string, archived = true) {
  const { data, error } = await (supabase.rpc as any)('archive_vendor_workspace_update', {
    target_update_id: updateId,
    archived_input: archived,
  });

  if (error) throw error;
  return data as VendorWorkspaceUpdate;
}
