import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type PlannerFreeWeddingStatus = {
  activeClientCount: number;
  archivedClientCount: number;
  meaningfulClientCount: number;
  freeTierLockedClientId: string | null;
  freeTierReplacementAvailable: boolean;
  freeTierConsumed: boolean;
  canAddWedding: boolean;
  gatingReason: string | null;
  businessIdentityKey: string | null;
  lockedClientIsMeaningful: boolean;
};

const emptyStatus: PlannerFreeWeddingStatus = {
  activeClientCount: 0,
  archivedClientCount: 0,
  meaningfulClientCount: 0,
  freeTierLockedClientId: null,
  freeTierReplacementAvailable: false,
  freeTierConsumed: false,
  canAddWedding: true,
  gatingReason: null,
  businessIdentityKey: null,
  lockedClientIsMeaningful: false,
};

export function usePlannerFreeWeddingStatus(enabled = true) {
  const { user, profile } = useAuth();
  const [status, setStatus] = useState<PlannerFreeWeddingStatus>(emptyStatus);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!enabled || !user || profile?.role !== 'planner') {
        if (!cancelled) {
          setStatus(emptyStatus);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const db = supabase as any;
        const { data, error } = await db.rpc('get_planner_free_wedding_status');
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled) {
          setStatus(row ? {
            activeClientCount: Number(row.active_client_count ?? 0),
            archivedClientCount: Number(row.archived_client_count ?? 0),
            meaningfulClientCount: Number(row.meaningful_client_count ?? 0),
            freeTierLockedClientId: row.free_tier_locked_client_id ?? null,
            freeTierReplacementAvailable: Boolean(row.free_tier_replacement_available),
            freeTierConsumed: Boolean(row.free_tier_consumed),
            canAddWedding: Boolean(row.can_add_wedding),
            gatingReason: row.gating_reason ?? null,
            businessIdentityKey: row.business_identity_key ?? null,
            lockedClientIsMeaningful: Boolean(row.locked_client_is_meaningful),
          } : emptyStatus);
        }
      } catch (error) {
        console.error('Could not load planner free wedding status:', error);
        if (!cancelled) {
          setStatus(emptyStatus);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [enabled, user, profile?.role]);

  return { status, loading };
}
