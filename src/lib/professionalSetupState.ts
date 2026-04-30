const PROFESSIONAL_SETUP_STORAGE_KEY = 'zania-professional-setup-pending';

type PendingProfessionalSetupState = {
  email: string | null;
};

export function persistPendingProfessionalSetup(email?: string | null) {
  if (typeof window === 'undefined') return;

  const payload: PendingProfessionalSetupState = {
    email: typeof email === 'string' && email.trim().length > 0 ? email.trim().toLowerCase() : null,
  };

  window.localStorage.setItem(PROFESSIONAL_SETUP_STORAGE_KEY, JSON.stringify(payload));
}

export function readPendingProfessionalSetup(email?: string | null): boolean {
  if (typeof window === 'undefined') return false;

  const raw = window.localStorage.getItem(PROFESSIONAL_SETUP_STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw) as PendingProfessionalSetupState;
    if (!parsed || typeof parsed !== 'object') return false;

    if (!parsed.email) return true;
    if (!email) return false;

    return parsed.email === email.trim().toLowerCase();
  } catch {
    return false;
  }
}

export function clearPendingProfessionalSetup() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PROFESSIONAL_SETUP_STORAGE_KEY);
}
