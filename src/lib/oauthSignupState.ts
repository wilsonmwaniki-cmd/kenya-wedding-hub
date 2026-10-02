import type { AppRole, PlannerType, SignupRole } from '@/lib/roles';
import { getCookieDomainForHostname } from '@/lib/appDomain';

const PENDING_OAUTH_SIGNUP_STORAGE_KEY = 'zania-pending-oauth-signup';
const PENDING_OAUTH_SIGNUP_COOKIE_KEY = 'zania_pending_oauth_signup';

export type PendingOAuthSignupState = {
  mode: 'signup' | 'signin';
  audience: 'couple' | 'professional' | 'admin';
  role: Extract<SignupRole, 'couple' | 'planner' | 'vendor'> | null;
  plannerType: PlannerType | null;
  fullName: string | null;
};

function getSharedCookieDomain() {
  if (typeof window === 'undefined') return null;

  return getCookieDomainForHostname(window.location.hostname);
}

function serializePendingOAuthSignupState(payload: PendingOAuthSignupState) {
  return JSON.stringify(payload);
}

function parsePendingOAuthSignupState(rawValue: string | null | undefined): PendingOAuthSignupState | null {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as PendingOAuthSignupState;
    if (parsed.audience !== 'couple' && parsed.audience !== 'professional' && parsed.audience !== 'admin') return null;
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

function writePendingOAuthSignupCookie(payload: PendingOAuthSignupState) {
  if (typeof document === 'undefined') return;

  const encodedValue = encodeURIComponent(serializePendingOAuthSignupState(payload));
  const domain = getSharedCookieDomain();
  const cookieParts = [
    `${PENDING_OAUTH_SIGNUP_COOKIE_KEY}=${encodedValue}`,
    'Path=/',
    'Max-Age=1800',
    'SameSite=Lax',
  ];

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    cookieParts.push('Secure');
  }

  if (domain) {
    cookieParts.push(`Domain=${domain}`);
  }

  document.cookie = cookieParts.join('; ');
}

function readPendingOAuthSignupCookie() {
  if (typeof document === 'undefined') return null;

  const cookiePrefix = `${PENDING_OAUTH_SIGNUP_COOKIE_KEY}=`;
  const cookieEntry = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(cookiePrefix));

  if (!cookieEntry) return null;

  return parsePendingOAuthSignupState(decodeURIComponent(cookieEntry.slice(cookiePrefix.length)));
}

function clearPendingOAuthSignupCookie() {
  if (typeof document === 'undefined') return;

  const domain = getSharedCookieDomain();
  const cookieParts = [
    `${PENDING_OAUTH_SIGNUP_COOKIE_KEY}=`,
    'Path=/',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'SameSite=Lax',
  ];

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    cookieParts.push('Secure');
  }

  if (domain) {
    cookieParts.push(`Domain=${domain}`);
  }

  document.cookie = cookieParts.join('; ');
}

export function getOAuthSignupTargetFromSearchParams(
  searchParams: URLSearchParams,
):
  | {
      mode: 'signup' | 'signin';
      audience: 'couple' | 'professional' | 'admin';
      role: Extract<SignupRole, 'couple' | 'planner' | 'vendor'> | null;
      plannerType: PlannerType | null;
    }
  | null {
  const audience = searchParams.get('audience');
  if (audience !== 'couple' && audience !== 'professional' && audience !== 'admin') return null;

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
  | { mode: 'signup' | 'signin'; audience: 'couple' | 'professional' | 'admin'; role: AppRole | null; plannerType: PlannerType | null; fullName: string | null }
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
  const serializedPayload = serializePendingOAuthSignupState(payload);
  window.sessionStorage.setItem(PENDING_OAUTH_SIGNUP_STORAGE_KEY, serializedPayload);
  writePendingOAuthSignupCookie(payload);
}

export function readPendingOAuthSignupState(): PendingOAuthSignupState | null {
  if (typeof window === 'undefined') return null;

  const rawValue = window.sessionStorage.getItem(PENDING_OAUTH_SIGNUP_STORAGE_KEY);
  const parsedFromSession = parsePendingOAuthSignupState(rawValue);
  if (parsedFromSession) return parsedFromSession;

  return readPendingOAuthSignupCookie();
}

export function clearPendingOAuthSignupState() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_OAUTH_SIGNUP_STORAGE_KEY);
  clearPendingOAuthSignupCookie();
}
