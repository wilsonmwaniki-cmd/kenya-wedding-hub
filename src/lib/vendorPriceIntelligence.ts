import { supabase } from '@/integrations/supabase/client';

// These types reference tables not yet in generated types - using any until DB schema syncs
export type VendorPriceObservation = any;
export type VendorPriceObservationInsert = any;
export type VendorPriceObservationUpdate = any;

export interface VendorPriceBenchmark {
  sample_size: number;
  benchmark_visible: boolean;
  average_amount: number | null;
  median_amount: number | null;
  minimum_amount: number | null;
  maximum_amount: number | null;
  percentile_25_amount: number | null;
  percentile_75_amount: number | null;
  vendor_count: number;
  last_observation_at: string | null;
}

export interface VendorPriceBenchmarkFilters {
  category?: string | null;
  venue?: string | null;
  county?: string | null;
  vendorListingId?: string | null;
  minSampleSize?: number;
}

export interface RecordVendorPriceObservationInput {
  amount: number;
  category: string;
  vendorName: string;
  vendorListingId?: string | null;
  clientId?: string | null;
  priceType?: 'quote' | 'booked' | 'final_paid';
  source?: 'manual' | 'planner_vendor_entry' | 'budget_entry' | 'vendor_submission' | 'admin_backfill';
  venue?: string | null;
  county?: string | null;
  guestCount?: number | null;
  weddingStyle?: string | null;
  eventDate?: string | null;
  notes?: string | null;
  isAnonymized?: boolean;
}

export interface ListVendorPriceObservationsFilters {
  clientId?: string | null;
  vendorListingId?: string | null;
  category?: string | null;
  limit?: number;
}

export async function listVendorPriceObservations({
  clientId,
  vendorListingId,
  category,
  limit = 100,
}: ListVendorPriceObservationsFilters = {}): Promise<VendorPriceObservation[]> {
  let query = (supabase as any)
    .from('vendor_price_observations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (clientId) query = query.eq('client_id', clientId);
  if (vendorListingId) query = query.eq('vendor_listing_id', vendorListingId);
  if (category) query = query.ilike('category', category);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as VendorPriceObservation[];
}

export async function createVendorPriceObservation(input: RecordVendorPriceObservationInput): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('record_vendor_price_observation', {
    observation_amount: input.amount,
    observation_category: input.category,
    vendor_name: input.vendorName,
    vendor_listing: input.vendorListingId ?? null,
    client: input.clientId ?? null,
    price_type_input: input.priceType ?? 'quote',
    source_input: input.source ?? 'manual',
    venue_input: input.venue ?? null,
    county_input: input.county ?? null,
    guest_count_input: input.guestCount ?? null,
    wedding_style_input: input.weddingStyle ?? null,
    event_date_input: input.eventDate ?? null,
    notes_input: input.notes ?? null,
    is_anonymized_input: input.isAnonymized ?? true,
  });

  if (error) throw error;
  return data as string;
}

export async function updateVendorPriceObservation(
  id: string,
  updates: VendorPriceObservationUpdate,
): Promise<VendorPriceObservation> {
  const { data, error } = await (supabase as any)
    .from('vendor_price_observations')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as VendorPriceObservation;
}

export async function deleteVendorPriceObservation(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('vendor_price_observations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getVendorPriceBenchmark(
  filters: VendorPriceBenchmarkFilters,
): Promise<VendorPriceBenchmark> {
  const { data, error } = await (supabase.rpc as any)('get_vendor_price_benchmark', {
    category_filter: filters.category ?? null,
    venue_filter: filters.venue ?? null,
    county_filter: filters.county ?? null,
    vendor_listing_filter: filters.vendorListingId ?? null,
    min_sample_size: filters.minSampleSize ?? 5,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    sample_size: row?.sample_size ?? 0,
    benchmark_visible: row?.benchmark_visible ?? false,
    average_amount: row?.average_amount ?? null,
    median_amount: row?.median_amount ?? null,
    minimum_amount: row?.minimum_amount ?? null,
    maximum_amount: row?.maximum_amount ?? null,
    percentile_25_amount: row?.percentile_25_amount ?? null,
    percentile_75_amount: row?.percentile_75_amount ?? null,
    vendor_count: row?.vendor_count ?? 0,
    last_observation_at: row?.last_observation_at ?? null,
  };
}
