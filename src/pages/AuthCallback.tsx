import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getHomeRouteForRole, type AppRole, type PlannerType } from '@/lib/roles';
import { hasPendingEstimatorPlanDraft } from '@/lib/estimatorPlanSeed';

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

        const { data: { user } } = await supabase.auth.getUser();
        const resolvedFromSession = getAuthTargetFromMetadata(user?.user_metadata);
        const { role, plannerType } = resolvedFromSession ?? getAuthTargetFromUserMetadata();
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
