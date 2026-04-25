import type { AppRole, PlannerType, SignupRole } from '@/lib/roles';

const PENDING_OAUTH_SIGNUP_STORAGE_KEY = 'zania-pending-oauth-signup';

export type PendingOAuthSignupState = {
  mode: 'signup' | 'signin';
  role: Extract<SignupRole, 'couple' | 'planner' | 'vendor'>;
  plannerType: PlannerType | null;
  fullName: string | null;
};

export function getOAuthSignupTargetFromSearchParams(
  searchParams: URLSearchParams,
):
  | { mode: 'signup' | 'signin'; role: Extract<SignupRole, 'couple' | 'planner' | 'vendor'>; plannerType: PlannerType | null }
  | null {
  const role = searchParams.get('target_role') ?? searchParams.get('signup_role');
  if (role !== 'couple' && role !== 'planner' && role !== 'vendor') return null;

  return {
    mode: searchParams.get('auth_mode') === 'signin' ? 'signin' : 'signup',
    role,
    plannerType: role === 'planner'
      ? (searchParams.get('planner_type') === 'committee' ? 'committee' : 'professional')
      : null,
  };
}

export function getPendingOAuthSignupTarget():
  | { mode: 'signup' | 'signin'; role: AppRole; plannerType: PlannerType | null; fullName: string | null }
  | null {
  const pendingState = readPendingOAuthSignupState();
  if (!pendingState) return null;

  return {
    mode: pendingState.mode,
    role: pendingState.role,
    plannerType: pendingState.role === 'planner'
      ? (pendingState.plannerType === 'committee' ? 'committee' : 'professional')
      : null,
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
    if (parsed.role !== 'couple' && parsed.role !== 'planner' && parsed.role !== 'vendor') return null;

    return {
      mode: parsed.mode === 'signin' ? 'signin' : 'signup',
      role: parsed.role,
      plannerType: parsed.role === 'planner'
        ? (parsed.plannerType === 'committee' ? 'committee' : 'professional')
        : null,
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
