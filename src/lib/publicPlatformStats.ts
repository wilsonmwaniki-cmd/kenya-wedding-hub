import { supabase } from '@/integrations/supabase/client';

export interface PublicPlatformStats {
  roundedWeddingPlansStarted: number;
  weddingPlansStartedDisplay: string;
}

interface PublicPlatformStatsRow {
  rounded_wedding_plans_started: number | null;
  wedding_plans_started_display: string | null;
}

export async function getPublicPlatformStats(): Promise<PublicPlatformStats | null> {
  const { data, error } = await supabase.rpc('get_public_platform_stats');

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const stats = row as PublicPlatformStatsRow;
  const roundedCount = Number(stats.rounded_wedding_plans_started ?? 0);
  const safeCount = Number.isFinite(roundedCount) ? roundedCount : 0;

  return {
    roundedWeddingPlansStarted: safeCount,
    weddingPlansStartedDisplay: stats.wedding_plans_started_display?.trim() || `${safeCount.toLocaleString()}+`,
  };
}
