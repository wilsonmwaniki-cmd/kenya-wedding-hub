import { supabase } from '@/integrations/supabase/client';

export interface PublicBudgetEstimateRow {
  category: string;
  source: string;
  sample_size: number;
  benchmark_visible: boolean;
  suggested_amount: number;
  low_amount: number;
  high_amount: number;
}

export interface PublicBudgetEstimateInput {
  guestCount: number;
  weddingStyle: 'intimate' | 'classic' | 'luxury' | 'garden';
  venueTier: 'budget' | 'mid_tier' | 'luxury';
  county?: string | null;
  minSampleSize?: number;
}

export async function getPublicBudgetEstimate(
  input: PublicBudgetEstimateInput,
): Promise<PublicBudgetEstimateRow[]> {
  const { data, error } = await (supabase.rpc as any)('get_public_budget_estimate', {
    guest_count_input: input.guestCount,
    wedding_style_input: input.weddingStyle,
    venue_tier_input: input.venueTier,
    county_input: input.county ?? null,
    min_sample_size: input.minSampleSize ?? 5,
  });

  if (error) throw error;
  return (data ?? []) as PublicBudgetEstimateRow[];
}