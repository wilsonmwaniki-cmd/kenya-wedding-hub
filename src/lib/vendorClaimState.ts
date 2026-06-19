const PENDING_VENDOR_CLAIM_STORAGE_KEY = 'zania-pending-vendor-claim';

export type PendingVendorClaimState = {
  claimType?: 'listing' | 'workspace_invite';
  token: string;
  email: string | null;
};

function normalizeEmail(email?: string | null) {
  if (typeof email !== 'string') return null;
  const value = email.trim().toLowerCase();
  return value.length > 0 ? value : null;
}

export function persistPendingVendorClaim(token: string, email?: string | null, claimType: 'listing' | 'workspace_invite' = 'listing') {
  if (typeof window === 'undefined') return;

  const normalizedToken = token.trim();
  if (!normalizedToken) return;

  const payload: PendingVendorClaimState = {
    claimType,
    token: normalizedToken,
    email: normalizeEmail(email),
  };

  window.localStorage.setItem(PENDING_VENDOR_CLAIM_STORAGE_KEY, JSON.stringify(payload));
}

export function readPendingVendorClaim(): PendingVendorClaimState | null {
  if (typeof window === 'undefined') return null;

  const rawValue = window.localStorage.getItem(PENDING_VENDOR_CLAIM_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as PendingVendorClaimState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.token !== 'string' || parsed.token.trim().length === 0) return null;

    return {
      claimType: parsed.claimType === 'workspace_invite' ? 'workspace_invite' : 'listing',
      token: parsed.token.trim(),
      email: normalizeEmail(parsed.email),
    };
  } catch {
    return null;
  }
}

export function clearPendingVendorClaim() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_VENDOR_CLAIM_STORAGE_KEY);
}

export function hasPendingVendorClaim() {
  return Boolean(readPendingVendorClaim());
}
