import { supabase } from '@/integrations/supabase/client';

export const vendorSelectionStatuses = ['shortlisted', 'final', 'backup', 'declined'] as const;

export type VendorSelectionStatus = typeof vendorSelectionStatuses[number];

export interface VendorAttachmentCandidate {
  name?: string | null;
  category?: string | null;
  phone?: string | null;
  email?: string | null;
  price?: number | null;
  vendor_listing_id?: string | null;
  notes?: string | null;
}

/**
 * Estimator categories are seeded as empty “Category shortlist” placeholders.
 * They help couples see what they may need, but are not recorded vendors until
 * the couple links a directory listing or adds identifying vendor details.
 */
export function hasRecordedVendor(candidate: VendorAttachmentCandidate) {
  if (candidate.vendor_listing_id) return true;

  const name = candidate.name?.trim() ?? '';
  const category = candidate.category?.trim() ?? '';
  const isEstimatorPlaceholder = Boolean(
    category
      && name.localeCompare(`${category} shortlist`, undefined, { sensitivity: 'accent' }) === 0
  );

  if (!isEstimatorPlaceholder) return Boolean(name);

  return Boolean(
    candidate.phone?.trim()
      || candidate.email?.trim()
      || (candidate.price != null && candidate.price > 0),
  );
}

export function isChosenVendor(candidate: VendorAttachmentCandidate & { selection_status?: string | null }) {
  return candidate.selection_status === 'final' && hasRecordedVendor(candidate);
}

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
