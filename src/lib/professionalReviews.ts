import { supabase } from '@/integrations/supabase/client';

export type ProfessionalType = 'vendor' | 'planner';

export interface ProfessionalReview {
  id: string;
  professional_type: ProfessionalType;
  vendor_listing_id: string | null;
  planner_profile_id: string | null;
  reviewer_name: string;
  rating: number;
  review_text: string | null;
  professional_reply: string | null;
  replied_at: string | null;
  created_at: string;
}

export interface ProfessionalReviewInvite {
  id: string;
  professional_name: string;
  professional_type: ProfessionalType;
  couple_name: string;
  couple_email: string;
  status: 'sent' | 'completed' | 'revoked';
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface PublicReviewInvite {
  professionalName: string;
  professionalType: ProfessionalType;
  coupleName: string;
  expiresAt: string;
}

const reviewClient = supabase;

async function functionError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    try {
      const payload = await error.context.clone().json();
      if (payload?.error && typeof payload.error === 'string') return new Error(payload.error);
    } catch {
      // Fall through to the SDK error message when the response is not JSON.
    }
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return new Error(error.message);
  }
  return new Error(fallback);
}

export async function listProfessionalReviewInvites() {
  const { data, error } = await reviewClient
    .from('professional_review_invites')
    .select('id, professional_name, professional_type, couple_name, couple_email, status, expires_at, used_at, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProfessionalReviewInvite[];
}

export async function createProfessionalReviewInvite(input: { coupleName: string; coupleEmail: string }) {
  const { data, error } = await supabase.functions.invoke('professional-reviews', {
    body: { action: 'create-invite', ...input },
  });
  if (error) throw await functionError(error, 'Could not send the review invitation.');
  if (data?.error) throw new Error(data.error);
  return data as { success: true; inviteId: string; expiresAt: string };
}

export async function revokeProfessionalReviewInvite(inviteId: string) {
  const { data, error } = await supabase.functions.invoke('professional-reviews', {
    body: { action: 'revoke-invite', inviteId },
  });
  if (error) throw await functionError(error, 'Could not revoke the review invitation.');
  if (data?.error) throw new Error(data.error);
}

export async function getPublicReviewInvite(token: string) {
  const { data, error } = await supabase.functions.invoke('professional-reviews', {
    body: { action: 'get-invite', token },
  });
  if (error) throw await functionError(error, 'This review invitation is invalid or has expired.');
  if (data?.error || !data?.invite) throw new Error(data?.error || 'This review invitation is invalid or has expired.');
  return data.invite as PublicReviewInvite;
}

export async function submitGuestProfessionalReview(input: {
  token: string;
  reviewerName: string;
  rating: number;
  reviewText: string;
}) {
  const { data, error } = await supabase.functions.invoke('professional-reviews', {
    body: { action: 'submit-review', ...input },
  });
  if (error) throw await functionError(error, 'Could not submit your review.');
  if (data?.error) throw new Error(data.error);
  return data as { success: true; reviewId: string };
}

export async function listPublishedProfessionalReviews(
  professionalType: ProfessionalType,
  professionalId: string,
) {
  const idColumn = professionalType === 'vendor' ? 'vendor_listing_id' : 'planner_profile_id';
  const { data, error } = await reviewClient
    .from('professional_reviews')
    .select('id, professional_type, vendor_listing_id, planner_profile_id, reviewer_name, rating, review_text, professional_reply, replied_at, created_at')
    .eq(idColumn, professionalId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProfessionalReview[];
}

export function summarizeProfessionalReviews(reviews: Pick<ProfessionalReview, 'rating'>[]) {
  if (reviews.length === 0) return { average: null, count: 0 };
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}
