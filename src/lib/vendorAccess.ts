export type VendorSubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

interface VendorAccessRecord {
  is_approved?: boolean | null;
  is_verified?: boolean | null;
  verification_requested?: boolean | null;
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
}

export function vendorHasActiveSubscription(record?: VendorAccessRecord | null) {
  if (!record) return false;
  if (record.subscription_status !== 'active') return false;
  if (!record.subscription_expires_at) return true;
  return new Date(record.subscription_expires_at).getTime() > Date.now();
}

export function vendorHasFullAccess(record?: VendorAccessRecord | null) {
  return Boolean(record?.is_approved && record?.is_verified && vendorHasActiveSubscription(record));
}

export function vendorAccessMessage(record?: VendorAccessRecord | null) {
  if (!record?.is_approved) return 'Listing approval is still pending.';
  if (!vendorHasActiveSubscription(record)) return 'Active subscription required before planner connections and analytics unlock.';
  if (record?.verification_requested && !record?.is_verified) return 'Verification request is in admin review.';
  if (!record?.is_verified) return 'Verification required.';
  return 'Full vendor access is active.';
}
