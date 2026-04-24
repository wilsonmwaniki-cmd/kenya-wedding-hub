import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getHomeRouteForRole, type AppRole, type PlannerType } from '@/lib/roles';
import { hasPendingEstimatorPlanDraft } from '@/lib/estimatorPlanSeed';
import {
  clearPendingOAuthSignupState,
  getPendingOAuthSignupTarget,
  readPendingOAuthSignupState,
} from '@/lib/oauthSignupState';
import { completePendingWeddingSetup, getPendingWeddingSetup } from '@/lib/weddingWorkspace';

function getAuthTargetFromMetadata(
  userMetadata: Record<string, unknown> | null | undefined,
): { role: AppRole; plannerType: PlannerType | null } | null {
  const role = userMetadata?.role;
  const plannerType = userMetadata?.planner_type;

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

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'failed'>('loading');

  useEffect(() => {
    let active = true;

    const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, fallbackValue: T) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        promise,
        new Promise<T>((resolve) => {
          timeoutId = setTimeout(() => {
            console.warn(`Auth callback step timed out after ${timeoutMs}ms; continuing with fallback state.`);
            resolve(fallbackValue);
          }, timeoutMs);
        }),
      ]);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return result;
    };

    const applyPendingOAuthSignupState = async (user: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']>) => {
      const pendingOAuthSignupState = readPendingOAuthSignupState();
      if (!pendingOAuthSignupState) return user;

      const currentMetadata = (user.user_metadata ?? {}) as Record<string, unknown>;
      const currentFullName = typeof currentMetadata.full_name === 'string' && currentMetadata.full_name.trim().length > 0
        ? currentMetadata.full_name.trim()
        : typeof currentMetadata.name === 'string' && currentMetadata.name.trim().length > 0
          ? currentMetadata.name.trim()
          : null;

      const desiredRole = pendingOAuthSignupState.role;
      const desiredPlannerType = desiredRole === 'planner' ? 'professional' : null;
      const needsRoleSync = currentMetadata.role !== desiredRole;
      const needsPlannerTypeSync = (currentMetadata.planner_type ?? null) !== desiredPlannerType;
      const needsFullNameSync = !currentFullName && !!pendingOAuthSignupState.fullName;

      if (!needsRoleSync && !needsPlannerTypeSync && !needsFullNameSync) {
        clearPendingOAuthSignupState();
        return user;
      }

      const nextMetadata: Record<string, unknown> = {
        ...currentMetadata,
        role: desiredRole,
        planner_type: desiredPlannerType,
        signup_intent: 'professional',
        wedding_setup_completed: true,
      };

      if (needsFullNameSync && pendingOAuthSignupState.fullName) {
        nextMetadata.full_name = pendingOAuthSignupState.fullName;
      }

      const { data, error } = await supabase.auth.updateUser({
        data: nextMetadata,
      });

      if (error) throw error;

      const { error: syncRoleError } = await supabase.rpc('sync_current_user_signup_role');
      if (syncRoleError) throw syncRoleError;
      return data.user ?? user;
    };

    const finalizeAuth = async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const code = new URL(window.location.href).searchParams.get('code');

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        const { data: { user: rawUser } } = await supabase.auth.getUser();
        const user = rawUser
          ? await withTimeout(applyPendingOAuthSignupState(rawUser), 4000, rawUser)
          : rawUser;
        const pendingWeddingSetup = user ? getPendingWeddingSetup(user.user_metadata, user.email ?? null) : null;

        if (user && pendingWeddingSetup) {
          const completion = await completePendingWeddingSetup(user);
          if (!active) return;
          navigate(completion.route, { replace: true });
          return;
        }

        const resolvedFromSession = getAuthTargetFromMetadata(user?.user_metadata);
        const pendingOAuthTarget = getPendingOAuthSignupTarget();
        const { role, plannerType } =
          resolvedFromSession
          ?? pendingOAuthTarget
          ?? getAuthTargetFromUserMetadata();
        window.history.replaceState({}, document.title, '/auth/callback');
        if (!active) return;

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
