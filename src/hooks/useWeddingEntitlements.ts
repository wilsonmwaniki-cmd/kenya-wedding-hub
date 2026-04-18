import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import type { CoupleEntitlementKey, CouplePlanTier } from '@/lib/pricingPlans';

type WeddingEntitlementsState = {
  weddingId: string | null;
  entitlements: Partial<Record<CoupleEntitlementKey, boolean>>;
  couplePlanTier: CouplePlanTier;
  loading: boolean;
};

const BASIC_COLLABORATION_KEYS: CoupleEntitlementKey[] = [
  'wedding_collaboration',
  'planner_collaboration',
  'vendor_collaboration',
  'committee_collaboration',
  'family_collaboration',
];

function inferCouplePlanTier(entitlements: Partial<Record<CoupleEntitlementKey, boolean>>): CouplePlanTier {
  if (entitlements.ai_wedding_assistant || entitlements.timeline_management) return 'premium';
  if (BASIC_COLLABORATION_KEYS.some((key) => entitlements[key])) return 'basic';
  return 'free';
}

export function useWeddingEntitlements() {
  const { user, profile, isSuperAdmin, rolePreview } = useAuth();
  const { isPlanner, selectedClient } = usePlanner();
  const [state, setState] = useState<WeddingEntitlementsState>({
    weddingId: null,
    entitlements: {},
    couplePlanTier: 'free',
    loading: true,
  });

  const shouldLoad = useMemo(
    () =>
      Boolean(
        user &&
          (profile?.role === 'couple' ||
            (isSuperAdmin && rolePreview === 'couple') ||
            (isPlanner && selectedClient)),
      ),
    [user, profile?.role, isSuperAdmin, rolePreview, isPlanner, selectedClient],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!shouldLoad || !user) {
        if (!cancelled) {
          setState({
            weddingId: null,
            entitlements: {},
            couplePlanTier: 'free',
            loading: false,
          });
        }
        return;
      }

      setState((current) => ({ ...current, loading: true }));

      try {
        const db = supabase as any;
        let activeWeddingId: string | null = null;

        if (isPlanner && selectedClient) {
          const { data: plannerClientRow, error: plannerClientError } = await db
            .from('planner_clients')
            .select('wedding_id')
            .eq('id', selectedClient.id)
            .maybeSingle();

          if (plannerClientError) throw plannerClientError;
          activeWeddingId = plannerClientRow?.wedding_id ?? null;
        }

        if (!activeWeddingId) {
          const { data: memberships, error: membershipError } = await db
            .from('wedding_memberships')
            .select('wedding_id, role, is_owner, membership_status, created_at')
            .eq('user_id', user.id)
            .in('membership_status', ['active', 'invited'])
            .order('is_owner', { ascending: false })
            .order('created_at', { ascending: true })
            .limit(10);

          if (membershipError) throw membershipError;
          activeWeddingId = memberships?.[0]?.wedding_id ?? null;
        }

        if (!activeWeddingId) {
          if (!cancelled) {
            setState({
              weddingId: null,
              entitlements: {},
              couplePlanTier: 'free',
              loading: false,
            });
          }
          return;
        }

        const { data: entitlementRows, error: entitlementError } = await db
          .from('wedding_entitlements')
          .select('feature_key, status, effective_from, effective_to')
          .eq('wedding_id', activeWeddingId)
          .eq('status', 'active');

        if (entitlementError) throw entitlementError;

        const now = Date.now();
        const entitlements = (entitlementRows ?? []).reduce<Partial<Record<CoupleEntitlementKey, boolean>>>(
          (summary, row: { feature_key: CoupleEntitlementKey; effective_from: string; effective_to: string | null }) => {
            const effectiveFrom = row.effective_from ? new Date(row.effective_from).getTime() : 0;
            const effectiveTo = row.effective_to ? new Date(row.effective_to).getTime() : null;
            if (effectiveFrom <= now && (effectiveTo == null || effectiveTo > now)) {
              summary[row.feature_key] = true;
            }
            return summary;
          },
          {},
        );

        if (!cancelled) {
          setState({
            weddingId: activeWeddingId,
            entitlements,
            couplePlanTier: inferCouplePlanTier(entitlements),
            loading: false,
          });
        }
      } catch (error) {
        console.error('Could not load wedding entitlements:', error);
        if (!cancelled) {
          setState({
            weddingId: null,
            entitlements: {},
            couplePlanTier: 'free',
            loading: false,
          });
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [shouldLoad, user, isPlanner, selectedClient]);

  return state;
}
