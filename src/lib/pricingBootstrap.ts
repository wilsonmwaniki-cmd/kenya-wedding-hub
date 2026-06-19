import { supabase } from '@/integrations/supabase/client';
import { hydratePricingCatalog } from '@/lib/pricingPlans';

export async function bootstrapPricingCatalogFromSupabase() {
  const { data, error } = await supabase
    .from('pricing_catalog')
    .select('config')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Could not load pricing catalog from Supabase. Falling back to local pricing config.', error);
    return;
  }

  hydratePricingCatalog((data?.config as any) ?? null);
}
