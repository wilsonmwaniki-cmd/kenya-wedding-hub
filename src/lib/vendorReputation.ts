import { supabase } from '@/integrations/supabase/client';

// These types reference tables not yet in generated types - using any until DB schema syncs
export type VendorReputationReview = any;
export type VendorReputationReviewInsert = any;
export type VendorReputationReviewUpdate = any;

export type VendorReputationVisibility = 'private' | 'planner_network' | 'admin_only';

export type VendorReputationIssueFlag =
  | 'late_setup'
  | 'late_delivery'
  | 'poor_communication'
  | 'deposit_risk'
  | 'quality_issue'
  | 'no_show'
  | 'scope_change'
  | 'budget_overrun'
  | 'unprofessional_staff'
  | 'payment_dispute';

export interface VendorReputationBenchmark {
  sample_size: number;
  benchmark_visible: boolean;
  average_overall_rating: number | null;
  average_reliability_rating: number | null;
  average_communication_rating: number | null;
  average_quality_rating: number | null;
  average_punctuality_rating: number | null;
  average_value_rating: number | null;
  hire_again_rate: number | null;
  on_time_rate: number | null;
  flagged_review_count: number | null;
  vendor_count: number;
  last_review_at: string | null;
}

export interface VendorReputationBenchmarkFilters {
  vendorListingId?: string | null;
  category?: string | null;
  minSampleSize?: number;
}

export interface RecordVendorReputationReviewInput {
  overallRating: number;
  reliabilityRating: number;
  communicationRating: number;
  qualityRating: number;
  punctualityRating: number;
  valueRating: number;
  vendorName?: string | null;
  vendorCategory?: string | null;
  vendorListingId?: string | null;
  sourceVendorId?: string | null;
  clientId?: string | null;
  eventDate?: string | null;
  deliveredOnTime?: boolean | null;
  wouldHireAgain?: boolean;
  issueFlags?: VendorReputationIssueFlag[];
  privateNotes?: string | null;
  visibility?: VendorReputationVisibility;
  isAnonymized?: boolean;
}

export interface ListVendorReputationReviewsFilters {
  clientId?: string | null;
  vendorListingId?: string | null;
  sourceVendorId?: string | null;
  visibility?: VendorReputationVisibility | null;
  limit?: number;
}

export async function listVendorReputationReviews({
  clientId,
  vendorListingId,
  sourceVendorId,
  visibility,
  limit = 100,
}: ListVendorReputationReviewsFilters = {}): Promise<VendorReputationReview[]> {
  let query = (supabase as any)
    .from('vendor_reputation_reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (clientId) query = query.eq('client_id', clientId);
  if (vendorListingId) query = query.eq('vendor_listing_id', vendorListingId);
  if (sourceVendorId) query = query.eq('source_vendor_id', sourceVendorId);
  if (visibility) query = query.eq('visibility', visibility);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as VendorReputationReview[];
}

export async function createVendorReputationReview(input: RecordVendorReputationReviewInput): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('record_vendor_reputation_review', {
    overall_rating_input: input.overallRating,
    reliability_input: input.reliabilityRating,
    communication_input: input.communicationRating,
    quality_input: input.qualityRating,
    punctuality_input: input.punctualityRating,
    value_input: input.valueRating,
    vendor_name_input: input.vendorName ?? null,
    vendor_category_input: input.vendorCategory ?? null,
    vendor_listing_input: input.vendorListingId ?? null,
    source_vendor_input: input.sourceVendorId ?? null,
    client_input: input.clientId ?? null,
    event_date_input: input.eventDate ?? null,
    delivered_on_time_input: input.deliveredOnTime ?? null,
    would_hire_again_input: input.wouldHireAgain ?? true,
    issue_flags_input: input.issueFlags ?? [],
    private_notes_input: input.privateNotes ?? null,
    visibility_input: input.visibility ?? 'planner_network',
    is_anonymized_input: input.isAnonymized ?? true,
  });

  if (error) throw error;
  return data as string;
}

export async function updateVendorReputationReview(
  id: string,
  updates: VendorReputationReviewUpdate,
): Promise<VendorReputationReview> {
  const { data, error } = await (supabase as any)
    .from('vendor_reputation_reviews')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as VendorReputationReview;
}

export async function deleteVendorReputationReview(id: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('vendor_reputation_reviews')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getVendorReputationBenchmark(
  filters: VendorReputationBenchmarkFilters,
): Promise<VendorReputationBenchmark> {
  const { data, error } = await (supabase.rpc as any)('get_vendor_reputation_benchmark', {
    vendor_listing_filter: filters.vendorListingId ?? null,
    category_filter: filters.category ?? null,
    min_sample_size: filters.minSampleSize ?? 3,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    sample_size: row?.sample_size ?? 0,
    benchmark_visible: row?.benchmark_visible ?? false,
    average_overall_rating: row?.average_overall_rating ?? null,
    average_reliability_rating: row?.average_reliability_rating ?? null,
    average_communication_rating: row?.average_communication_rating ?? null,
    average_quality_rating: row?.average_quality_rating ?? null,
    average_punctuality_rating: row?.average_punctuality_rating ?? null,
    average_value_rating: row?.average_value_rating ?? null,
    hire_again_rate: row?.hire_again_rate ?? null,
    on_time_rate: row?.on_time_rate ?? null,
    flagged_review_count: row?.flagged_review_count ?? null,
    vendor_count: row?.vendor_count ?? 0,
    last_review_at: row?.last_review_at ?? null,
  };
}