import { supabase } from '@/integrations/supabase/client';

export const vendorSelectionStatuses = ['shortlisted', 'final', 'backup', 'declined'] as const;

export type VendorSelectionStatus = typeof vendorSelectionStatuses[number];

export function vendorSelectionLabel(status: VendorSelectionStatus | string | null | undefined) {
  switch (status) {
    case 'final':
      return 'Final choice';
    case 'backup':
      return 'Backup';
    case 'declined':
      return 'Declined';
    case 'shortlisted':
    default:
      return 'Shortlisted';
  }
}

export function vendorSelectionTone(status: VendorSelectionStatus | string | null | undefined) {
  switch (status) {
    case 'final':
      return 'default' as const;
    case 'backup':
      return 'secondary' as const;
    case 'declined':
      return 'destructive' as const;
    case 'shortlisted':
    default:
      return 'outline' as const;
  }
}

export async function setVendorSelectionStatus(vendorId: string, selectionStatus: VendorSelectionStatus) {
  const { data, error } = await supabase.rpc('set_vendor_selection_status', {
    vendor_id_input: vendorId,
    selection_status_input: selectionStatus,
  });

  if (error) throw error;
  return data as VendorSelectionStatus;
}
