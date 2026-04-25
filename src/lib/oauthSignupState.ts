import type { AppRole, PlannerType, SignupRole } from '@/lib/roles';

const PENDING_OAUTH_SIGNUP_STORAGE_KEY = 'zania-pending-oauth-signup';

export type PendingOAuthSignupState = {
  role: Extract<SignupRole, 'planner' | 'vendor'>;
  plannerType: 'professional' | null;
  fullName: string | null;
};

export function getOAuthSignupTargetFromSearchParams(
  searchParams: URLSearchParams,
):
  | { role: Extract<SignupRole, 'planner' | 'vendor'>; plannerType: PlannerType | null }
  | null {
  const role = searchParams.get('signup_role');
  if (role !== 'planner' && role !== 'vendor') return null;

  return {
    role,
    plannerType: role === 'planner' ? 'professional' : null,
  };
}

export function getPendingOAuthSignupTarget():
  | { role: AppRole; plannerType: PlannerType | null; fullName: string | null }
  | null {
  const pendingState = readPendingOAuthSignupState();
  if (!pendingState) return null;

  return {
    role: pendingState.role,
    plannerType: pendingState.role === 'planner' ? 'professional' : null,
    fullName: pendingState.fullName,
  };
}

export function persistPendingOAuthSignupState(payload: PendingOAuthSignupState) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_OAUTH_SIGNUP_STORAGE_KEY, JSON.stringify(payload));
}

export function readPendingOAuthSignupState(): PendingOAuthSignupState | null {
  if (typeof window === 'undefined') return null;

  const rawValue = window.sessionStorage.getItem(PENDING_OAUTH_SIGNUP_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as PendingOAuthSignupState;
    if (parsed.role !== 'planner' && parsed.role !== 'vendor') return null;

    return {
      role: parsed.role,
      plannerType: parsed.role === 'planner' ? 'professional' : null,
      fullName: typeof parsed.fullName === 'string' && parsed.fullName.trim().length > 0
        ? parsed.fullName.trim()
        : null,
    };
  } catch {
    return null;
  }
}

export function clearPendingOAuthSignupState() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_OAUTH_SIGNUP_STORAGE_KEY);
}
