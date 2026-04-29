import type { AppRole, PlannerType, SignupRole } from '@/lib/roles';

const PENDING_OAUTH_SIGNUP_STORAGE_KEY = 'zania-pending-oauth-signup';

export type PendingOAuthSignupState = {
  mode: 'signup' | 'signin';
  audience: 'couple' | 'professional';
  role: Extract<SignupRole, 'couple' | 'planner' | 'vendor'> | null;
  plannerType: PlannerType | null;
  fullName: string | null;
};

export function getOAuthSignupTargetFromSearchParams(
  searchParams: URLSearchParams,
):
  | {
      mode: 'signup' | 'signin';
      audience: 'couple' | 'professional';
      role: Extract<SignupRole, 'couple' | 'planner' | 'vendor'> | null;
      plannerType: PlannerType | null;
    }
  | null {
  const audience = searchParams.get('audience');
  if (audience !== 'couple' && audience !== 'professional') return null;

  const rawRole = searchParams.get('target_role') ?? searchParams.get('signup_role');
  const role =
    rawRole === 'couple' || rawRole === 'planner' || rawRole === 'vendor'
      ? rawRole
      : null;

  return {
    mode: searchParams.get('auth_mode') === 'signin' ? 'signin' : 'signup',
    audience,
    role,
    plannerType: role === 'planner'
      ? (searchParams.get('planner_type') === 'committee' ? 'committee' : 'professional')
      : null,
  };
}

export function getPendingOAuthSignupTarget():
  | { mode: 'signup' | 'signin'; audience: 'couple' | 'professional'; role: AppRole | null; plannerType: PlannerType | null; fullName: string | null }
  | null {
  const pendingState = readPendingOAuthSignupState();
  if (!pendingState) return null;

  return {
    mode: pendingState.mode,
    audience: pendingState.audience,
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
    if (parsed.audience !== 'couple' && parsed.audience !== 'professional') return null;
    if (parsed.role !== null && parsed.role !== 'couple' && parsed.role !== 'planner' && parsed.role !== 'vendor') return null;

    return {
      mode: parsed.mode === 'signin' ? 'signin' : 'signup',
      audience: parsed.audience,
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
