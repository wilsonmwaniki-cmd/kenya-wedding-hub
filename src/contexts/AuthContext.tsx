import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole, PlannerType, SignupRole } from '@/lib/roles';
import {
  clearPendingOAuthSignupState,
  getPendingOAuthSignupTarget,
} from '@/lib/oauthSignupState';
import {
  completePendingWeddingSetup,
  getPendingWeddingSetup,
  type WeddingOwnerRole,
  type WeddingSignupIntent,
} from '@/lib/weddingWorkspace';

interface Profile {
  id: string;
  user_id: string;
  collaboration_code: string | null;
  full_name: string | null;
  partner_name: string | null;
  wedding_date: string | null;
  wedding_location: string | null;
  wedding_county: string | null;
  wedding_town: string | null;
  role: AppRole;
  company_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_website: string | null;
  stripe_customer_id: string | null;
  bio: string | null;
  specialties: string[] | null;
  avatar_url: string | null;
  planner_type: PlannerType | null;
  committee_name: string | null;
  planner_verified: boolean;
  planner_verification_requested: boolean;
  planner_verification_requested_at: string | null;
  planner_subscription_status: 'inactive' | 'active' | 'past_due' | 'cancelled';
  planner_subscription_started_at: string | null;
  planner_subscription_expires_at: string | null;
  planning_pass_status: 'inactive' | 'active' | 'past_due' | 'cancelled';
  planning_pass_started_at: string | null;
  planning_pass_expires_at: string | null;
  primary_county: string | null;
  primary_town: string | null;
  service_areas: string[] | null;
  travel_scope: 'local_only' | 'selected_counties' | 'nationwide' | null;
  minimum_budget_kes: number | null;
  maximum_budget_kes: number | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  baseProfile: Profile | null;
  availableRoles: AppRole[];
  loading: boolean;
  isSuperAdmin: boolean;
  rolePreview: RolePreview;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role?: SignupRole,
    options?: {
      signupIntent?: WeddingSignupIntent | null;
      weddingOwnerRole?: WeddingOwnerRole | null;
      partnerEmail?: string | null;
      weddingName?: string | null;
      weddingCode?: string | null;
      weddingDate?: string | null;
      committeeName?: string | null;
      weddingCounty?: string | null;
      weddingTown?: string | null;
      primaryCounty?: string | null;
      primaryTown?: string | null;
    }
  ) => Promise<void>;
  signIn: (
    email: string,
    password: string,
    options?: {
      targetRole?: Extract<SignupRole, 'couple' | 'planner' | 'vendor'> | null;
      plannerType?: PlannerType | null;
    }
  ) => Promise<void>;
  signInWithGoogle: (options?: {
    signupRole?: Extract<SignupRole, 'planner' | 'vendor'> | null;
    plannerType?: PlannerType | null;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  setRolePreview: (role: RolePreview) => void;
  clearRolePreview: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ROLE_PREVIEW_STORAGE_KEY = 'zania-admin-role-preview';
export type RolePreview = 'admin' | 'couple' | 'vendor' | 'planner' | 'committee';

type RequestedSignupState = {
  role: AppRole;
  plannerType: PlannerType | null;
  committeeName: string | null;
} | null;

const clearStoredSupabaseAuthState = () => {
  if (typeof window === 'undefined') return;

  const clearMatchingKeys = (storage: Storage) => {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (!key) continue;

      if (key.startsWith('sb-')) {
        storage.removeItem(key);
      }
    }
  };

  clearMatchingKeys(window.localStorage);
  clearMatchingKeys(window.sessionStorage);
};

const plannerPreviewExpiry = () => {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  return nextYear.toISOString();
};

const withTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T,
  label: string,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => {
        console.warn(`${label} timed out after ${timeoutMs}ms; continuing with fallback state.`);
        resolve(fallbackValue);
      }, timeoutMs);
    }),
  ]);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  return result;
};

const buildPreviewProfile = (baseProfile: Profile, preview: RolePreview): Profile => {
  if (preview === 'admin') return baseProfile;

  if (preview === 'vendor') {
    return {
      ...baseProfile,
      role: 'vendor',
      company_name: baseProfile.company_name || `${baseProfile.full_name || 'Admin'} Test Vendor`,
      company_email: baseProfile.company_email || baseProfile.user_id,
    };
  }

  if (preview === 'couple') {
    return {
      ...baseProfile,
      role: 'couple',
      planner_type: null,
      committee_name: null,
    };
  }

  return {
    ...baseProfile,
    role: 'planner',
    planner_type: preview === 'committee' ? 'committee' : 'professional',
    committee_name: preview === 'committee' ? (baseProfile.committee_name || `${baseProfile.full_name || 'Admin'} Committee`) : null,
    planner_verified: true,
    planner_verification_requested: false,
    planner_verification_requested_at: null,
    planner_subscription_status: 'active',
    planner_subscription_expires_at: plannerPreviewExpiry(),
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [baseProfile, setBaseProfile] = useState<Profile | null>(null);
  const [availableRoles, setAvailableRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolePreview, setRolePreviewState] = useState<RolePreview>('admin');
  const pendingWeddingRecoveryRef = useRef<string | null>(null);
  const authHydrationRequestRef = useRef(0);

  const getFallbackFullName = (authUser: User) => {
    const fullName = authUser.user_metadata?.full_name;
    const name = authUser.user_metadata?.name;
    const givenName = authUser.user_metadata?.given_name;
    const familyName = authUser.user_metadata?.family_name;
    const combinedName = [givenName, familyName].filter(Boolean).join(' ').trim();

    return fullName || name || combinedName || authUser.email?.split('@')[0] || '';
  };

  const getFallbackRole = async (authUser: User): Promise<AppRole> => {
    const requestedRole = authUser.user_metadata?.role;
    if (requestedRole === 'committee') return 'planner';
    if (requestedRole === 'admin' || requestedRole === 'vendor' || requestedRole === 'planner' || requestedRole === 'couple') {
      return requestedRole;
    }

    const pendingOAuthTarget = getPendingOAuthSignupTarget();
    if (pendingOAuthTarget) {
      return pendingOAuthTarget.role;
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', authUser.id);

    if (error || !data?.length) return 'couple';

    const rolePriority: Record<AppRole, number> = {
      admin: 4,
      vendor: 3,
      planner: 2,
      couple: 1,
    };

    return [...data]
      .sort((a, b) => rolePriority[b.role as AppRole] - rolePriority[a.role as AppRole])[0]
      .role as AppRole;
  };

  const fetchAvailableRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) throw error;

      const normalizedRoles = Array.from(
        new Set((data ?? []).map((entry) => entry.role as AppRole)),
      );
      setAvailableRoles(normalizedRoles);
      return normalizedRoles;
    } catch (error) {
      console.error('Failed to load available roles:', error);
      setAvailableRoles([]);
      return [];
    }
  };

  const ensureRequestedRoleExists = async (
    userId: string,
    targetRole: Extract<SignupRole, 'couple' | 'planner' | 'vendor'>,
  ) => {
    const roles = await fetchAvailableRoles(userId);
    if (roles.includes(targetRole)) return roles;

    const roleLabel = targetRole === 'couple' ? 'couple' : targetRole;
    throw new Error(`This email does not have a ${roleLabel} account yet. Choose the matching sign up path first.`);
  };

  const activateRequestedRole = async (
    authUser: User,
    targetRole: Extract<SignupRole, 'couple' | 'planner' | 'vendor'>,
    plannerType?: PlannerType | null,
  ) => {
    await ensureRequestedRoleExists(authUser.id, targetRole);

    const { error } = await (supabase as any).rpc('apply_current_user_signup_target', {
      target_role_text: targetRole,
      target_planner_type_text: targetRole === 'planner' ? (plannerType ?? 'professional') : null,
      target_full_name: getFallbackFullName(authUser) || null,
      target_committee_name: null,
    });

    if (error) throw error;
  };

  const updateActiveRoleMetadata = async (
    authUser: User,
    targetRole: Extract<SignupRole, 'couple' | 'planner' | 'vendor'>,
    plannerType?: PlannerType | null,
  ) => {
    const currentMetadata = (authUser.user_metadata ?? {}) as Record<string, unknown>;
    const nextMetadata: Record<string, unknown> = {
      ...currentMetadata,
      role: targetRole,
      planner_type: targetRole === 'planner' ? (plannerType ?? 'professional') : null,
      signup_intent: targetRole === 'couple'
        ? (typeof currentMetadata.signup_intent === 'string' ? currentMetadata.signup_intent : 'create_wedding')
        : 'professional',
      wedding_setup_completed: targetRole !== 'couple',
    };

    const { data, error } = await supabase.auth.updateUser({
      data: nextMetadata,
    });

    if (error) throw error;

    await supabase.auth.refreshSession();

    return data.user ?? authUser;
  };

  const getRequestedSignupState = (authUser: User): RequestedSignupState => {
    const requestedRole = authUser.user_metadata?.role;
    const requestedPlannerType = authUser.user_metadata?.planner_type;
    const requestedCommitteeName = authUser.user_metadata?.committee_name;
    const pendingOAuthTarget = getPendingOAuthSignupTarget();

    if (
      requestedRole !== 'admin' &&
      requestedRole !== 'couple' &&
      requestedRole !== 'vendor' &&
      requestedRole !== 'planner' &&
      requestedRole !== 'committee'
    ) {
      if (!pendingOAuthTarget) {
        return null;
      }

      return {
        role: pendingOAuthTarget.role,
        plannerType: pendingOAuthTarget.plannerType,
        committeeName: null,
      };
    }

    const resolvedRole: AppRole = requestedRole === 'committee' ? 'planner' : requestedRole;
    const resolvedPlannerType: PlannerType | null = requestedRole === 'committee'
      ? 'committee'
      : requestedRole === 'planner'
        ? requestedPlannerType === 'committee'
          ? 'committee'
          : 'professional'
        : null;

    return {
      role: resolvedRole,
      plannerType: resolvedPlannerType,
      committeeName: resolvedPlannerType === 'committee'
        ? (typeof requestedCommitteeName === 'string' && requestedCommitteeName.trim().length > 0
          ? requestedCommitteeName.trim()
          : null)
        : null,
    };
  };

  const buildFallbackProfile = (authUser: User, role: AppRole): Profile => ({
    id: authUser.id,
    user_id: authUser.id,
    collaboration_code: null,
    full_name: getFallbackFullName(authUser) || null,
    partner_name: null,
    wedding_date: null,
    wedding_location: null,
    wedding_county: null,
    wedding_town: null,
    role,
    company_name: null,
    company_email: authUser.email ?? null,
    company_phone: null,
    company_website: null,
    stripe_customer_id: null,
    bio: null,
    specialties: null,
    avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
    planner_type: authUser.user_metadata?.planner_type === 'committee'
      ? 'committee'
      : role === 'planner'
        ? 'professional'
        : null,
    committee_name: authUser.user_metadata?.committee_name || null,
    planner_verified: false,
    planner_verification_requested: false,
    planner_verification_requested_at: null,
    planner_subscription_status: 'inactive',
    planner_subscription_started_at: null,
    planner_subscription_expires_at: null,
    planning_pass_status: 'inactive',
    planning_pass_started_at: null,
    planning_pass_expires_at: null,
    primary_county: null,
    primary_town: null,
    service_areas: [],
    travel_scope: 'selected_counties',
    minimum_budget_kes: null,
    maximum_budget_kes: null,
  });

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error.message);
      setBaseProfile(null);
      return null;
    }

    if (!data) {
      setBaseProfile(null);
      return null;
    }

    setBaseProfile(data as Profile);
    return data as Profile;
  };

  const syncMissingProfileIdentity = async (authUser: User, existingProfile: Profile): Promise<Profile> => {
    const resolvedFullName = getFallbackFullName(authUser).trim();
    const resolvedAvatarUrl = authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null;
    const updates: Partial<Profile> = {};

    if (!existingProfile.full_name?.trim() && resolvedFullName) {
      updates.full_name = resolvedFullName;
    }

    if (!existingProfile.avatar_url && resolvedAvatarUrl) {
      updates.avatar_url = resolvedAvatarUrl;
    }

    if (Object.keys(updates).length === 0) {
      return existingProfile;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', authUser.id);

      if (error) throw error;

      const refreshedProfile = await fetchProfile(authUser.id);
      if (refreshedProfile) return refreshedProfile;
    } catch (error) {
      console.error('Failed to sync missing profile identity from auth metadata:', error);
    }

    const fallbackProfile: Profile = {
      ...existingProfile,
      ...updates,
    };
    setBaseProfile(fallbackProfile);
    return fallbackProfile;
  };

  const reconcileRequestedSignupState = async (
    authUser: User,
    existingProfile: Profile,
  ): Promise<Profile> => {
    const requestedSignupState = getRequestedSignupState(authUser);
    if (!requestedSignupState) return existingProfile;

    const needsRoleSync = existingProfile.role !== requestedSignupState.role;
    const needsPlannerTypeSync = (existingProfile.planner_type ?? null) !== requestedSignupState.plannerType;
    const needsCommitteeNameSync = requestedSignupState.plannerType === 'committee'
      && (existingProfile.committee_name ?? null) !== requestedSignupState.committeeName;

    if (!needsRoleSync && !needsPlannerTypeSync && !needsCommitteeNameSync) {
      return existingProfile;
    }

    try {
      const { error } = await (supabase as any).rpc('apply_current_user_signup_target', {
        target_role_text: requestedSignupState.role,
        target_planner_type_text: requestedSignupState.plannerType,
        target_full_name: getFallbackFullName(authUser) || null,
        target_committee_name: requestedSignupState.committeeName,
      });
      if (error) throw error;

      const syncedProfile = await fetchProfile(authUser.id);
      if (syncedProfile) return syncedProfile;
    } catch (error) {
      console.error('Failed to apply signup role from auth metadata:', error);
    }

    try {
      const fallbackUpdates: Partial<Profile> = {
        role: requestedSignupState.role,
        planner_type: requestedSignupState.plannerType,
        committee_name: requestedSignupState.plannerType === 'committee'
          ? requestedSignupState.committeeName
          : null,
      };

      const { error } = await supabase
        .from('profiles')
        .update(fallbackUpdates)
        .eq('user_id', authUser.id);

      if (error) throw error;

      const patchedProfile = await fetchProfile(authUser.id);
      if (patchedProfile) return patchedProfile;
    } catch (error) {
      console.error('Failed to patch mismatched signup role on profile:', error);
    }

    const fallbackProfile: Profile = {
      ...existingProfile,
      role: requestedSignupState.role,
      planner_type: requestedSignupState.plannerType,
      committee_name: requestedSignupState.plannerType === 'committee'
        ? requestedSignupState.committeeName
        : null,
    };
    setBaseProfile(fallbackProfile);
    return fallbackProfile;
  };

  const ensureProfile = async (authUser: User) => {
    const existingProfile = await fetchProfile(authUser.id);
    if (existingProfile) {
      const reconciledProfile = await reconcileRequestedSignupState(authUser, existingProfile);
      const profileWithIdentity = await syncMissingProfileIdentity(authUser, reconciledProfile);

      const pendingOAuthTarget = getPendingOAuthSignupTarget();
      if (
        pendingOAuthTarget &&
        profileWithIdentity.role === pendingOAuthTarget.role &&
        (profileWithIdentity.planner_type ?? null) === pendingOAuthTarget.plannerType
      ) {
        clearPendingOAuthSignupState();
      }

      return profileWithIdentity;
    }

    const role = await getFallbackRole(authUser);
    const fullName = getFallbackFullName(authUser);
    const plannerType = authUser.user_metadata?.planner_type === 'committee'
      ? 'committee'
      : role === 'planner'
        ? 'professional'
        : null;
    const committeeName = plannerType === 'committee'
      ? authUser.user_metadata?.committee_name ?? null
      : null;

    const { error } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.id,
        full_name: fullName,
        role,
        planner_type: plannerType,
        committee_name: committeeName,
      });

    if (error && error.code !== '23505') {
      console.error('Failed to recover missing profile:', error.message);
      const fallbackProfile = buildFallbackProfile(authUser, role);
      setBaseProfile(fallbackProfile);
      return fallbackProfile;
    }

    const recoveredProfile = await fetchProfile(authUser.id);
    if (recoveredProfile) {
      const pendingOAuthTarget = getPendingOAuthSignupTarget();
      if (
        pendingOAuthTarget &&
        recoveredProfile.role === pendingOAuthTarget.role &&
        (recoveredProfile.planner_type ?? null) === pendingOAuthTarget.plannerType
      ) {
        clearPendingOAuthSignupState();
      }
      return recoveredProfile;
    }

    const fallbackProfile = buildFallbackProfile(authUser, role);
    setBaseProfile(fallbackProfile);
    return fallbackProfile;
  };

  const syncAuthState = async (
    nextSession: Session | null,
    options?: { requestId?: number },
  ) => {
    if (
      typeof options?.requestId === 'number' &&
      authHydrationRequestRef.current !== options.requestId
    ) {
      return;
    }

    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (nextSession?.user) {
      await fetchAvailableRoles(nextSession.user.id);
      await ensureProfile(nextSession.user);
      return;
    }

    pendingWeddingRecoveryRef.current = null;
    setBaseProfile(null);
    setAvailableRoles([]);
  };

  useEffect(() => {
    if (!user) return;

    const pendingSetup = getPendingWeddingSetup(user.user_metadata, user.email ?? null);
    if (!pendingSetup) {
      pendingWeddingRecoveryRef.current = null;
      return;
    }

    const attemptKey = `${user.id}:${pendingSetup.intent}:${pendingSetup.weddingName ?? ''}:${pendingSetup.partnerEmail ?? ''}:${pendingSetup.weddingCode ?? ''}`;
    if (pendingWeddingRecoveryRef.current === attemptKey) return;
    pendingWeddingRecoveryRef.current = attemptKey;

    let active = true;

    const recoverPendingWeddingSetup = async () => {
      try {
        const completion = await completePendingWeddingSetup(user);
        if (!active || !completion.handled || typeof window === 'undefined') return;

        pendingWeddingRecoveryRef.current = `completed:${user.id}`;
        await ensureProfile(user);

        const targetPath = completion.route;
        const currentPath = `${window.location.pathname}${window.location.search}`;

        if (targetPath && currentPath !== targetPath) {
          window.location.replace(targetPath);
        }
      } catch (error) {
        console.error('Could not auto-finish pending wedding setup:', error);
        pendingWeddingRecoveryRef.current = null;
      }
    };

    void recoverPendingWeddingSetup();

    return () => {
      active = false;
    };
  }, [user]);

  const hydrateSessionFromHash = async () => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.includes('access_token=')) return;

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (!accessToken || !refreshToken) return;

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('Failed to hydrate auth session from callback hash:', error.message);
      return;
    }

    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${window.location.search}`,
    );
  };

  const getSessionWithTimeout = async (timeoutMs = 2500): Promise<{
    session: Session | null;
    timedOut: boolean;
    sessionPromise: Promise<Session | null>;
  }> => {
    const sessionPromise = supabase.auth.getSession().then(({ data: { session } }) => session);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      sessionPromise,
      new Promise<'timeout'>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn(`Auth session lookup timed out after ${timeoutMs}ms; continuing without blocking app startup.`);
          resolve('timeout');
        }, timeoutMs);
      }),
    ]);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    return {
      session: result === 'timeout' ? null : result,
      timedOut: result === 'timeout',
      sessionPromise,
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedPreview = window.localStorage.getItem(ROLE_PREVIEW_STORAGE_KEY);
    if (
      storedPreview === 'admin' ||
      storedPreview === 'couple' ||
      storedPreview === 'vendor' ||
      storedPreview === 'planner' ||
      storedPreview === 'committee'
    ) {
      setRolePreviewState(storedPreview);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ROLE_PREVIEW_STORAGE_KEY, rolePreview);
  }, [rolePreview]);

  useEffect(() => {
    if (!baseProfile) return;
    if (baseProfile.role === 'admin') return;
    if (rolePreview !== 'admin') {
      setRolePreviewState('admin');
    }
  }, [baseProfile?.role]);

  const profile = useMemo(() => {
    if (!baseProfile) {
      if (!user) return null;

      const requestedSignupState = getRequestedSignupState(user);
      const pendingOAuthTarget = getPendingOAuthSignupTarget();
      const inferredRole: AppRole = requestedSignupState?.role
        ?? pendingOAuthTarget?.role
        ?? (
          user.user_metadata?.role === 'committee'
            ? 'planner'
            : user.user_metadata?.role === 'admin'
              || user.user_metadata?.role === 'vendor'
              || user.user_metadata?.role === 'planner'
              || user.user_metadata?.role === 'couple'
              ? user.user_metadata.role
              : user.user_metadata?.planner_type === 'committee' || user.user_metadata?.planner_type === 'professional'
                ? 'planner'
                : 'couple'
        );

      const fallbackProfile = {
        ...buildFallbackProfile(user, inferredRole),
        planner_type: requestedSignupState?.plannerType
          ?? pendingOAuthTarget?.plannerType
          ?? buildFallbackProfile(user, inferredRole).planner_type,
        committee_name: requestedSignupState?.committeeName
          ?? buildFallbackProfile(user, inferredRole).committee_name,
      };

      if (fallbackProfile.role !== 'admin') return fallbackProfile;
      return buildPreviewProfile(fallbackProfile, rolePreview);
    }

    if (baseProfile.role !== 'admin') return baseProfile;
    return buildPreviewProfile(baseProfile, rolePreview);
  }, [baseProfile, rolePreview, user]);

  const isSuperAdmin = baseProfile?.role === 'admin';

  useEffect(() => {
    if (!user || baseProfile) return;

    let active = true;

    const recoverMissingProfile = async () => {
      try {
        await ensureProfile(user);
      } catch (error) {
        console.error('Failed to recover missing in-memory profile after sign-in:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void recoverMissingProfile();

    return () => {
      active = false;
    };
  }, [user, baseProfile]);

  useEffect(() => {
    if (!user || !baseProfile) return;

    const requestedSignupState = getRequestedSignupState(user);
    const pendingOAuthTarget = getPendingOAuthSignupTarget();
    const expectedRole = requestedSignupState?.role ?? pendingOAuthTarget?.role ?? null;
    const expectedPlannerType = requestedSignupState?.plannerType ?? pendingOAuthTarget?.plannerType ?? null;
    const expectedCommitteeName = requestedSignupState?.committeeName ?? null;
    const resolvedFullName = getFallbackFullName(user).trim();
    const resolvedAvatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

    const roleMismatch = expectedRole != null && baseProfile.role !== expectedRole;
    const plannerTypeMismatch = (baseProfile.planner_type ?? null) !== expectedPlannerType;
    const committeeNameMismatch = expectedPlannerType === 'committee'
      && (baseProfile.committee_name ?? null) !== expectedCommitteeName;
    const missingIdentity = (!baseProfile.full_name?.trim() && !!resolvedFullName)
      || (!baseProfile.avatar_url && !!resolvedAvatarUrl);

    if (!roleMismatch && !plannerTypeMismatch && !committeeNameMismatch && !missingIdentity) {
      if (
        pendingOAuthTarget &&
        baseProfile.role === pendingOAuthTarget.role &&
        (baseProfile.planner_type ?? null) === pendingOAuthTarget.plannerType
      ) {
        clearPendingOAuthSignupState();
      }
      return;
    }

    let active = true;

    const reconcileProfileState = async () => {
      const reconciledProfile = await reconcileRequestedSignupState(user, baseProfile);
      if (!active) return;

      const profileWithIdentity = await syncMissingProfileIdentity(user, reconciledProfile);
      if (!active) return;

      if (
        pendingOAuthTarget &&
        profileWithIdentity.role === pendingOAuthTarget.role &&
        (profileWithIdentity.planner_type ?? null) === pendingOAuthTarget.plannerType
      ) {
        clearPendingOAuthSignupState();
      }
    };

    void reconcileProfileState();

    return () => {
      active = false;
    };
  }, [
    user,
    baseProfile,
    baseProfile?.avatar_url,
    baseProfile?.committee_name,
    baseProfile?.full_name,
    baseProfile?.planner_type,
    baseProfile?.role,
  ]);

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (!active) return;
          await syncAuthState(session);
        } finally {
          if (active) setLoading(false);
        }
      }
    );

    const initializeAuth = async () => {
      const requestId = ++authHydrationRequestRef.current;

      try {
        await hydrateSessionFromHash();
        const { session, timedOut, sessionPromise } = await getSessionWithTimeout();
        if (!active) return;
        await syncAuthState(session, { requestId });

        if (timedOut) {
          void sessionPromise
            .then(async (lateSession) => {
              if (
                !active ||
                !lateSession ||
                authHydrationRequestRef.current !== requestId
              ) {
                return;
              }

              setLoading(true);
              try {
                await syncAuthState(lateSession, { requestId });
              } finally {
                if (active) setLoading(false);
              }
            })
            .catch((error) => {
              console.error('Late auth session lookup failed:', error);
            });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void initializeAuth();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    role: SignupRole = 'couple',
    options?: {
      signupIntent?: WeddingSignupIntent | null;
      weddingOwnerRole?: WeddingOwnerRole | null;
      partnerEmail?: string | null;
      weddingName?: string | null;
      weddingCode?: string | null;
      weddingDate?: string | null;
      committeeName?: string | null;
      weddingCounty?: string | null;
      weddingTown?: string | null;
      primaryCounty?: string | null;
      primaryTown?: string | null;
    },
  ) => {
    const isCommittee = role === 'committee';
    const weddingCounty = options?.weddingCounty?.trim() || null;
    const weddingTown = options?.weddingTown?.trim() || null;
    const primaryCounty = options?.primaryCounty?.trim() || null;
    const primaryTown = options?.primaryTown?.trim() || null;
    const partnerEmail = options?.partnerEmail?.trim().toLowerCase() || null;
    const weddingName = options?.weddingName?.trim() || null;
    const weddingCode = options?.weddingCode?.trim().toUpperCase() || null;
    const signupIntent = options?.signupIntent ?? 'professional';
    const weddingDate = options?.weddingDate?.trim() || null;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: isCommittee ? 'planner' : role,
          planner_type: isCommittee ? 'committee' : role === 'planner' ? 'professional' : null,
          committee_name: isCommittee ? options?.committeeName ?? null : null,
          signup_intent: signupIntent,
          wedding_setup_completed: signupIntent === 'professional',
          wedding_owner_role: options?.weddingOwnerRole ?? null,
          partner_email: partnerEmail,
          wedding_name: weddingName,
          wedding_code: weddingCode,
          wedding_county: weddingCounty,
          wedding_town: weddingTown,
          wedding_date: weddingDate,
          wedding_location: weddingTown || weddingCounty ? [weddingTown, weddingCounty].filter(Boolean).join(', ') : null,
          primary_county: primaryCounty,
          primary_town: primaryTown,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;

    if (data.session) {
      setLoading(true);
      try {
        await syncAuthState(data.session);
      } finally {
        setLoading(false);
      }
    }
  };

  const signIn = async (
    email: string,
    password: string,
    options?: {
      targetRole?: Extract<SignupRole, 'couple' | 'planner' | 'vendor'> | null;
      plannerType?: PlannerType | null;
    },
  ) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (data.session) {
      setLoading(true);
      try {
        if (options?.targetRole) {
          const updatedUser = await updateActiveRoleMetadata(
            data.session.user,
            options.targetRole,
            options.plannerType ?? null,
          );
          await activateRequestedRole(updatedUser, options.targetRole, options.plannerType ?? null);
        }
        const {
          data: { session: refreshedSession },
        } = await supabase.auth.getSession();
        await syncAuthState(refreshedSession ?? data.session);
      } finally {
        setLoading(false);
      }
    }
  };

  const signInWithGoogle = async (options?: {
    signupRole?: Extract<SignupRole, 'planner' | 'vendor'> | null;
    plannerType?: PlannerType | null;
  }) => {
    const redirectUrl = new URL(`${window.location.origin}/auth/callback`);

    if (options?.signupRole) {
      redirectUrl.searchParams.set('signup_role', options.signupRole);
      if (options.signupRole === 'planner') {
        redirectUrl.searchParams.set(
          'planner_type',
          options.plannerType === 'committee' ? 'committee' : 'professional',
        );
      }
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl.toString(),
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setRolePreviewState('admin');
    authHydrationRequestRef.current += 1;
    clearPendingOAuthSignupState();
    let globalSignOutError: Error | null = null;

    try {
      const globalResult = await withTimeout(
        supabase.auth.signOut({ scope: 'global' }),
        2500,
        { error: null as Error | null },
        'Supabase global sign out',
      );
      const { error } = globalResult;
      if (error && !/session/i.test(error.message)) {
        globalSignOutError = error;
      }
    } catch (error: any) {
      if (!/session/i.test(error?.message ?? '')) {
        globalSignOutError = error;
      }
    }

    try {
      const localResult = await withTimeout(
        supabase.auth.signOut({ scope: 'local' }),
        1500,
        { error: null as Error | null },
        'Supabase local sign out',
      );
      if (localResult.error && !/session/i.test(localResult.error.message) && !globalSignOutError) {
        globalSignOutError = localResult.error;
      }
    } catch (error: any) {
      if (!/session/i.test(error?.message ?? '') && !globalSignOutError) {
        globalSignOutError = error;
      }
    } finally {
      clearStoredSupabaseAuthState();
      await syncAuthState(null);
      setLoading(false);
    }

    if (globalSignOutError) {
      console.warn('Supabase global sign out did not fully complete, but local session was cleared.', globalSignOutError);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);
    if (error) throw error;
    await fetchProfile(user.id);
  };

  const setRolePreview = (role: RolePreview) => {
    setRolePreviewState(role);
  };

  const clearRolePreview = () => {
    setRolePreviewState('admin');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        baseProfile,
        availableRoles,
        loading,
        isSuperAdmin,
        rolePreview,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateProfile,
        setRolePreview,
        clearRolePreview,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
