import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { ProfessionalAudience, ProfessionalEntitlementKey } from '@/lib/pricingPlans';

type ProfessionalEntitlementsState = {
  audience: ProfessionalAudience | null;
  entitlements: Partial<Record<ProfessionalEntitlementKey, boolean>>;
  teamSeatLimit: number;
  loading: boolean;
};

export function useProfessionalEntitlements(audienceOverride?: ProfessionalAudience | null) {
  const { user, profile, isSuperAdmin, rolePreview } = useAuth();
  const [state, setState] = useState<ProfessionalEntitlementsState>({
    audience: audienceOverride ?? null,
    entitlements: {},
    teamSeatLimit: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const resolvedAudience: ProfessionalAudience | null = audienceOverride
      ?? (profile?.role === 'planner' && profile?.planner_type !== 'committee'
        ? 'planner'
        : profile?.role === 'vendor'
          ? 'vendor'
          : isSuperAdmin && rolePreview === 'planner'
            ? 'planner'
            : isSuperAdmin && rolePreview === 'vendor'
              ? 'vendor'
              : null);

    const load = async () => {
      if (!user || !resolvedAudience) {
        if (!cancelled) {
          setState({
            audience: resolvedAudience,
            entitlements: {},
            teamSeatLimit: 0,
            loading: false,
          });
        }
        return;
      }

      if (isSuperAdmin && (rolePreview === 'planner' || rolePreview === 'vendor')) {
        if (!cancelled) {
          setState({
            audience: resolvedAudience,
            entitlements: {},
            teamSeatLimit: 0,
            loading: false,
          });
        }
        return;
      }

      setState((current) => ({ ...current, audience: resolvedAudience, loading: true }));

      try {
        const db = supabase as any;
        const { data: rows, error } = await db
          .from('professional_entitlements')
          .select('feature_key, status, effective_from, effective_to, seat_limit')
          .eq('user_id', user.id)
          .eq('audience', resolvedAudience)
          .eq('status', 'active');

        if (error) throw error;

        const now = Date.now();
        const entitlements = (rows ?? []).reduce<Partial<Record<ProfessionalEntitlementKey, boolean>>>(
          (
            summary,
            row: {
              feature_key: ProfessionalEntitlementKey;
              effective_from: string;
              effective_to: string | null;
            },
          ) => {
            const effectiveFrom = row.effective_from ? new Date(row.effective_from).getTime() : 0;
            const effectiveTo = row.effective_to ? new Date(row.effective_to).getTime() : null;
            if (effectiveFrom <= now && (effectiveTo == null || effectiveTo > now)) {
              summary[row.feature_key] = true;
            }
            return summary;
          },
          {},
        );

        const teamSeatLimit = (rows ?? []).reduce(
          (maxSeats: number, row: { feature_key: ProfessionalEntitlementKey; seat_limit: number | null }) =>
            row.feature_key === 'team_workspace' ? Math.max(maxSeats, row.seat_limit ?? 0) : maxSeats,
          0,
        );

        if (!cancelled) {
          setState({
            audience: resolvedAudience,
            entitlements,
            teamSeatLimit,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Could not load professional entitlements:', error);
        if (!cancelled) {
          setState({
            audience: resolvedAudience,
            entitlements: {},
            teamSeatLimit: 0,
            loading: false,
          });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [audienceOverride, user, profile?.role, profile?.planner_type, isSuperAdmin, rolePreview]);

  return state;
}
