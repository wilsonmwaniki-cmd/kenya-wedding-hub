import { supabase } from '@/integrations/supabase/client';

export type LeadProviderType = 'vendor' | 'planner';
export type LeadRequestStatus = 'open' | 'matched' | 'no_match' | 'selected' | 'closed' | 'cancelled' | 'expired';
export type LeadMatchStatus = 'invited' | 'accepted' | 'passed' | 'selected' | 'not_selected' | 'expired';

export interface LeadRequest {
  id: string;
  wedding_id: string;
  provider_type: LeadProviderType;
  category_key: string;
  status: LeadRequestStatus;
  created_at: string;
  expires_at: string;
}

export interface LeadBrief {
  lead_request_id: string;
  wedding_date: string;
  location_county: string | null;
  location_town: string | null;
  estimated_guest_count: number | null;
  budget_min_kes: number | null;
  budget_max_kes: number | null;
  wedding_type: string | null;
  top_priorities: string[];
}

export interface LeadMatch {
  id: string;
  lead_request_id: string;
  provider_type: LeadProviderType;
  provider_user_id: string;
  provider_name: string;
  provider_category: string;
  match_reasons: string[];
  status: LeadMatchStatus;
  invited_at: string;
  responded_at: string | null;
}

export interface LeadMessage {
  id: string;
  match_id: string;
  sender_side: 'couple' | 'provider';
  body: string;
  created_at: string;
}

export interface LeadOffer {
  id: string;
  match_id: string;
  amount_kes: number;
  summary: string;
  valid_until: string | null;
  status: 'submitted' | 'withdrawn' | 'accepted' | 'declined';
  created_at: string;
}

// New lead tables are introduced by the staging migration and are not in the
// checked-in generated types until the production rollout is approved.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const leadTable = (name: string) => (supabase.from as any)(name);

export async function createLeadRequest(weddingId: string, providerType: LeadProviderType, category: string) {
  const { data, error } = await leadTable('lead_requests')
    .insert({ wedding_id: weddingId, provider_type: providerType, category_key: category })
    .select('id, wedding_id, provider_type, category_key, status, created_at, expires_at')
    .single();
  if (error) throw error;
  return data as LeadRequest;
}

export async function listWeddingLeadRequests(weddingId: string) {
  const { data, error } = await leadTable('lead_requests')
    .select('id, wedding_id, provider_type, category_key, status, created_at, expires_at')
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadRequest[];
}

export async function listLeadMatches(requestIds?: string[]) {
  if (requestIds && requestIds.length === 0) return [] as LeadMatch[];
  let query = leadTable('lead_matches')
    .select('id, lead_request_id, provider_type, provider_user_id, provider_name, provider_category, match_reasons, status, invited_at, responded_at')
    .order('invited_at', { ascending: false });
  if (requestIds?.length) query = query.in('lead_request_id', requestIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LeadMatch[];
}

export async function getLeadMatch(matchId: string) {
  const { data, error } = await leadTable('lead_matches')
    .select('id, lead_request_id, provider_type, provider_user_id, provider_name, provider_category, match_reasons, status, invited_at, responded_at')
    .eq('id', matchId)
    .single();
  if (error) throw error;
  return data as LeadMatch;
}

export async function listLeadBriefs(requestIds: string[]) {
  if (!requestIds.length) return [] as LeadBrief[];
  const { data, error } = await leadTable('lead_briefs').select('*').in('lead_request_id', requestIds);
  if (error) throw error;
  return (data ?? []) as LeadBrief[];
}

export async function updateLeadMatchStatus(matchId: string, status: 'accepted' | 'passed' | 'selected') {
  const { data, error } = await leadTable('lead_matches')
    .update({ status })
    .eq('id', matchId)
    .select('id, status, responded_at')
    .single();
  if (error) throw error;
  return data as Pick<LeadMatch, 'id' | 'status' | 'responded_at'>;
}

export async function listLeadMessages(matchId: string) {
  const { data, error } = await leadTable('lead_messages')
    .select('id, match_id, sender_side, body, created_at')
    .eq('match_id', matchId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as LeadMessage[];
}

export async function sendLeadMessage(matchId: string, senderSide: 'couple' | 'provider', body: string) {
  const { data, error } = await leadTable('lead_messages')
    .insert({ match_id: matchId, sender_side: senderSide, body: body.trim() })
    .select('id, match_id, sender_side, body, created_at')
    .single();
  if (error) throw error;
  return data as LeadMessage;
}

export async function listLeadOffers(matchId: string) {
  const { data, error } = await leadTable('lead_offers').select('*').eq('match_id', matchId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadOffer[];
}

export async function submitLeadOffer(matchId: string, amountKes: number, summary: string) {
  const { data, error } = await leadTable('lead_offers')
    .insert({ match_id: matchId, amount_kes: amountKes, summary: summary.trim() })
    .select('*')
    .single();
  if (error) throw error;
  return data as LeadOffer;
}

export async function revealLeadContact(matchId: string) {
  const { data, error } = await leadTable('lead_contact_reveals')
    .insert({ match_id: matchId })
    .select('*')
    .single();
  if (error) throw error;
  return data as { match_id: string; couple_name: string | null; couple_email: string | null; couple_phone: string | null };
}

export async function getLeadContact(matchId: string) {
  const { data, error } = await leadTable('lead_contact_reveals').select('*').eq('match_id', matchId).maybeSingle();
  if (error) throw error;
  return data as { match_id: string; couple_name: string | null; couple_email: string | null; couple_phone: string | null } | null;
}

export function formatLeadBudgetRange(brief?: Pick<LeadBrief, 'budget_min_kes' | 'budget_max_kes'> | null) {
  if (!brief?.budget_min_kes || !brief?.budget_max_kes) return 'Budget not set';
  return `KES ${brief.budget_min_kes.toLocaleString()}–${brief.budget_max_kes.toLocaleString()}`;
}
