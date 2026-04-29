import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getHomeRouteForRole, isProfessionalSetupPending, type AppRole, type PlannerType } from '@/lib/roles';
import { hasPendingEstimatorPlanDraft } from '@/lib/estimatorPlanSeed';
import {
  clearPendingOAuthSignupState,
  getOAuthSignupTargetFromSearchParams,
  getPendingOAuthSignupTarget,
  readPendingOAuthSignupState,
} from '@/lib/oauthSignupState';
import {
  persistPendingProfessionalSetup,
  readPendingProfessionalSetup,
} from '@/lib/professionalSetupState';
import { completePendingWeddingSetup, getPendingWeddingSetup } from '@/lib/weddingWorkspace';

function getAuthTargetFromMetadata(
  userMetadata: Record<string, unknown> | null | undefined,
): { role: AppRole; plannerType: PlannerType | null } | null {
  const role = userMetadata?.role;
  const plannerType = userMetadata?.planner_type;

  if (
    userMetadata?.signup_intent === 'professional'
    && userMetadata?.professional_role_locked === false
  ) {
    return { role: 'planner', plannerType: 'professional' };
  }

  if (role === 'committee') {
    return { role: 'planner', plannerType: 'committee' };
  }

  if (role === 'planner') {
    return {
      role: 'planner',
      plannerType: plannerType === 'committee' ? 'committee' : 'professional',
    };
  }

  if (role === 'admin' || role === 'vendor' || role === 'couple') {
    return {
      role,
      plannerType: null,
    };
  }

  return null;
}

function getAuthTargetFromUserMetadata(): { role: AppRole; plannerType: PlannerType | null } {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hashParams.get('access_token');

  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      const resolvedTarget = getAuthTargetFromMetadata(payload?.user_metadata);
      if (resolvedTarget) {
        return resolvedTarget;
      }
    } catch {
      // Ignore malformed token payloads and fall back to default route.
    }
  }

  return { role: 'couple', plannerType: null };
}

function getAuthTargetFromCallbackUrl(): { role: AppRole; plannerType: PlannerType | null } | null {
  const target = getOAuthSignupTargetFromSearchParams(new URL(window.location.href).searchParams);
  return target?.role ? { role: target.role, plannerType: target.plannerType } : null;
}

function getOAuthAuthTarget():
  | {
      mode: 'signup' | 'signin';
      audience: 'couple' | 'professional';
      role: 'couple' | 'planner' | 'vendor' | null;
      plannerType: PlannerType | null;
    }
  | null {
  const callbackUrlTarget = getOAuthSignupTargetFromSearchParams(new URL(window.location.href).searchParams);
  if (callbackUrlTarget) return callbackUrlTarget;

  const pendingOAuthTarget = getPendingOAuthSignupTarget();
  if (pendingOAuthTarget?.role === 'couple' || pendingOAuthTarget?.role === 'planner' || pendingOAuthTarget?.role === 'vendor') {
    return pendingOAuthTarget;
  }

  return null;
}

function matchesOAuthTarget(
  userMetadata: Record<string, unknown> | null | undefined,
  target: {
    audience: 'couple' | 'professional';
    role: 'couple' | 'planner' | 'vendor' | null;
    plannerType: PlannerType | null;
  } | null,
) {
  if (!target) return true;
  if (target.audience === 'professional' && target.role === null) {
    return (
      userMetadata?.signup_intent === 'professional'
      && userMetadata?.professional_role_locked === false
    );
  }

  const currentRole =
    userMetadata?.role === 'committee'
      ? 'planner'
      : userMetadata?.role === 'couple' || userMetadata?.role === 'planner' || userMetadata?.role === 'vendor'
        ? userMetadata.role
        : null;
  const currentPlannerType =
    currentRole === 'planner'
      ? userMetadata?.planner_type === 'committee'
        ? 'committee'
        : 'professional'
      : null;

  return currentRole === target.role && currentPlannerType === target.plannerType;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'failed'>('loading');

  useEffect(() => {
    let active = true;

    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallbackValue: T, label: string) => {
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

    const rejectUnexpectedOAuthSignIn = async (
      role: 'couple' | 'planner' | 'vendor' | null,
      plannerType: PlannerType | null,
    ) => {
      clearPendingOAuthSignupState();
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore sign-out cleanup errors here; we still redirect the user back into auth.
      }

      const nextUrl = new URL('/auth', window.location.origin);
      nextUrl.searchParams.set('auth_error', 'missing_role');
      nextUrl.searchParams.set('mode', 'signin');
      nextUrl.searchParams.set('audience', role === 'couple' ? 'couple' : 'professional');
      if (role) {
        nextUrl.searchParams.set('role', role);
      }
      if (role === 'planner' && plannerType) {
        nextUrl.searchParams.set('planner_type', plannerType);
      }
      window.location.replace(nextUrl.toString());
    };

    const applyPendingOAuthSignupState = async (user: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>) => {
      const pendingOAuthSignupState = readPendingOAuthSignupState();
      const callbackOAuthTarget = getOAuthAuthTarget();
      if (!pendingOAuthSignupState && !callbackOAuthTarget) return user;

      const currentMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const currentFullName = typeof currentMetadata.full_name === 'string' && currentMetadata.full_name.trim().length > 0
        ? currentMetadata.full_name.trim()
        : typeof currentMetadata.name === 'string' && currentMetadata.name.trim().length > 0
          ? currentMetadata.name.trim()
          : null;

      const authMode = pendingOAuthSignupState?.mode ?? callbackOAuthTarget?.mode ?? 'signup';
      const desiredRole = pendingOAuthSignupState?.role ?? callbackOAuthTarget?.role;
      const requestedAudience = pendingOAuthSignupState?.audience ?? callbackOAuthTarget?.audience ?? null;
      const shouldPrepareProfessionalSetup = requestedAudience === 'professional' && !desiredRole;
      if (!desiredRole) {
        if (authMode === 'signin' && requestedAudience === 'professional') {
          const { data: existingRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          if (rolesError) throw rolesError;

          const hasProfessionalRole = (existingRoles ?? []).some((entry) => entry.role === 'planner' || entry.role === 'vendor');
          const alreadyPendingProfessionalSetup =
            user.user_metadata?.signup_intent === 'professional'
            && user.user_metadata?.professional_role_locked === false;
          const locallyPendingProfessionalSetup = readPendingProfessionalSetup(user.email ?? null);

          if (!hasProfessionalRole && !alreadyPendingProfessionalSetup && !locallyPendingProfessionalSetup) {
            await rejectUnexpectedOAuthSignIn(null, null);
            throw new Error('OAuth sign-in rejected because this email does not hold a professional role.');
          }
        }

        if (shouldPrepareProfessionalSetup) {
          const currentMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
          const currentFullName = typeof currentMetadata.full_name === 'string' && currentMetadata.full_name.trim().length > 0
            ? currentMetadata.full_name.trim()
            : typeof currentMetadata.name === 'string' && currentMetadata.name.trim().length > 0
              ? currentMetadata.name.trim()
              : null;
          const needsProfessionalSetupSync =
            currentMetadata.signup_intent !== 'professional'
            || currentMetadata.professional_role_locked !== false
            || currentMetadata.wedding_setup_completed !== true
            || (!currentFullName && !!pendingOAuthSignupState?.fullName);

          if (needsProfessionalSetupSync) {
            const nextMetadata: Record<string, unknown> = {
              ...currentMetadata,
              role: 'planner',
              planner_type: 'professional',
              signup_intent: 'professional',
              professional_role_locked: false,
              wedding_setup_completed: true,
            };

            if (!currentFullName && pendingOAuthSignupState?.fullName) {
              nextMetadata.full_name = pendingOAuthSignupState.fullName;
            }

            const { data, error } = await supabase.auth.updateUser({ data: nextMetadata });
            if (error) throw error;

            await supabase.auth.refreshSession();
            const { error: applyProfessionalPlaceholderError } = await (supabase as any).rpc('apply_current_user_signup_target', {
              target_role_text: 'planner',
              target_planner_type_text: 'professional',
              target_full_name: typeof nextMetadata.full_name === 'string' ? nextMetadata.full_name : currentFullName,
              target_committee_name: null,
            });
            if (applyProfessionalPlaceholderError) throw applyProfessionalPlaceholderError;
            persistPendingProfessionalSetup(user.email ?? null);
            clearPendingOAuthSignupState();
            return data.user ?? user;
          }

          persistPendingProfessionalSetup(user.email ?? null);
        }

        clearPendingOAuthSignupState();
        return user;
      }

      const desiredPlannerType =
        desiredRole === 'planner'
          ? (pendingOAuthSignupState?.plannerType ?? callbackOAuthTarget?.plannerType ?? 'professional')
          : null;

      if (authMode === 'signin') {
        const { data: existingRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (rolesError) throw rolesError;

        const allowedRoles = new Set((existingRoles ?? []).map((entry) => entry.role));
        if (!allowedRoles.has(desiredRole)) {
          await rejectUnexpectedOAuthSignIn(desiredRole, desiredPlannerType);
          throw new Error('OAuth sign-in rejected because this email does not hold the requested role.');
        }
      }

      const needsRoleSync = currentMetadata.role !== desiredRole;
      const needsPlannerTypeSync = (currentMetadata.planner_type ?? null) !== desiredPlannerType;
      const needsFullNameSync = !currentFullName && !!pendingOAuthSignupState?.fullName;

      if (!needsRoleSync && !needsPlannerTypeSync && !needsFullNameSync) {
        clearPendingOAuthSignupState();
        return user;
      }

      const nextMetadata: Record<string, unknown> = {
        ...currentMetadata,
        role: desiredRole,
        planner_type: desiredPlannerType,
        signup_intent: 'professional',
        professional_role_locked:
          pendingOAuthSignupState?.audience === 'professional' && authMode === 'signup'
            ? false
            : currentMetadata.professional_role_locked,
        wedding_setup_completed: true,
      };

      if (needsFullNameSync && pendingOAuthSignupState?.fullName) {
        nextMetadata.full_name = pendingOAuthSignupState.fullName;
      }

      const { data, error } = await supabase.auth.updateUser({
        data: nextMetadata,
      });

      if (error) throw error;

      // Refresh auth claims before any RPC that relies on auth.jwt() to derive roles.
      await supabase.auth.refreshSession();

      const { error: profilePatchError } = await supabase
        .from('profiles')
        .update({
          role: desiredRole,
          planner_type: desiredPlannerType,
          committee_name: desiredPlannerType === 'committee'
            ? (typeof nextMetadata.committee_name === 'string' ? nextMetadata.committee_name : null)
            : null,
          full_name: typeof nextMetadata.full_name === 'string' && nextMetadata.full_name.trim().length > 0
            ? nextMetadata.full_name
            : undefined,
        })
        .eq('user_id', user.id);

      if (profilePatchError) {
        console.error('Failed to patch profile role after OAuth signup:', profilePatchError);
      }

      const { error: applyRoleError } = await (supabase as any).rpc('apply_current_user_signup_target', {
        target_role_text: desiredRole,
        target_planner_type_text: desiredPlannerType,
        target_full_name: typeof nextMetadata.full_name === 'string' ? nextMetadata.full_name : null,
        target_committee_name:
          desiredPlannerType === 'committee' && typeof nextMetadata.committee_name === 'string'
            ? nextMetadata.committee_name
            : null,
      });
      if (applyRoleError) throw applyRoleError;

      const refreshedUser = await withTimeout(
        supabase.auth.getUser().then(({ data }) => data.user),
        2500,
        data.user ?? user,
        'Auth callback refreshed user lookup',
      );

      if (matchesOAuthTarget(refreshedUser?.user_metadata, callbackOAuthTarget ?? pendingOAuthTarget ?? null)) {
        clearPendingOAuthSignupState();
      }

      return refreshedUser ?? data.user ?? user;
    };

    const finalizeAuth = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const code = new URL(window.location.href).searchParams.get('code');
      const callbackUrlTarget = getAuthTargetFromCallbackUrl();
      const pendingOAuthTarget = getPendingOAuthSignupTarget();
      const metadataTarget = getAuthTargetFromUserMetadata();
      const fallbackTarget =
        callbackUrlTarget
        ?? pendingOAuthTarget
        ?? metadataTarget;

      try {
        if (accessToken && refreshToken) {
          const sessionResult = await withTimeout(
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }),
            5000,
            { data: { session: null, user: null }, error: null },
            'Auth callback session restore',
          );
          if (sessionResult.error) throw sessionResult.error;
        } else if (code) {
          const exchangeResult = await withTimeout(
            supabase.auth.exchangeCodeForSession(code),
            5000,
            { data: { session: null, user: null }, error: null },
            'Auth callback code exchange',
          );
          if (exchangeResult.error) throw exchangeResult.error;
        }

        const rawUser = await withTimeout(
          supabase.auth.getUser().then(({ data }) => data.user),
          4000,
          null,
          'Auth callback user lookup',
        );
        const user = rawUser
          ? await withTimeout(
              applyPendingOAuthSignupState(rawUser),
              4000,
              rawUser,
              'Auth callback role reconciliation',
            )
          : rawUser;
        const pendingWeddingSetup = user ? getPendingWeddingSetup(user.user_metadata, user.email ?? null) : null;

        if (user && pendingWeddingSetup) {
          const completion = await withTimeout(
            completePendingWeddingSetup(user),
            5000,
            null,
            'Auth callback wedding setup completion',
          );
          if (!active) return;
          if (completion) {
            navigate(completion.route, { replace: true });
            return;
          }
        }

        const resolvedFromSession = getAuthTargetFromMetadata(user?.user_metadata);
      const resolvedTarget = matchesOAuthTarget(user?.user_metadata, callbackUrlTarget ?? pendingOAuthTarget ?? null)
          ? resolvedFromSession
          : callbackUrlTarget ?? pendingOAuthTarget ?? resolvedFromSession;
        const { role, plannerType } =
          resolvedTarget
          ?? fallbackTarget;
        window.history.replaceState({}, document.title, '/auth/callback');
        if (!active) return;

        if (user && isProfessionalSetupPending(user.user_metadata, role, user.email ?? null)) {
          navigate('/settings', { replace: true });
          return;
        }

        if (hasPendingEstimatorPlanDraft()) {
          navigate('/auth', { replace: true });
          return;
        }

        navigate(getHomeRouteForRole(role, plannerType), { replace: true });
      } catch (error) {
        console.error('Failed to complete auth callback:', error);
        if (active) setStatus('failed');
      }
    };

    void finalizeAuth();

    return () => {
      active = false;
    };
  }, [navigate]);

  if (status === 'failed') {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
