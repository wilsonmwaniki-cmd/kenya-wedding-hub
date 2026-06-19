import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { posthog, posthogEnabled } from '@/posthog';

export default function AppAnalytics() {
  const location = useLocation();
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!posthogEnabled || typeof window === 'undefined') return;

    posthog.capture('$pageview', {
      pathname: `${location.pathname}${location.search}${location.hash}`,
      role: profile?.role ?? null,
      planner_type: profile?.planner_type ?? null,
      wedding_county: profile?.wedding_county ?? null,
      primary_county: profile?.primary_county ?? null,
      current_url: window.location.href,
    });
  }, [
    location.hash,
    location.pathname,
    location.search,
    profile?.planner_type,
    profile?.primary_county,
    profile?.role,
    profile?.wedding_county,
  ]);

  useEffect(() => {
    if (!posthogEnabled) return;

    if (!user) {
      posthog.reset();
      return;
    }

    posthog.identify(user.id, {
      email: user.email ?? null,
      role: profile?.role ?? null,
      planner_type: profile?.planner_type ?? null,
      beta_trial_status: profile?.beta_trial_status ?? null,
      planner_verified: profile?.planner_verified ?? false,
      founding_planner_contributor: profile?.founding_planner_contributor ?? false,
    });
  }, [
    profile?.beta_trial_status,
    profile?.founding_planner_contributor,
    profile?.planner_type,
    profile?.planner_verified,
    profile?.role,
    user,
  ]);

  return null;
}
