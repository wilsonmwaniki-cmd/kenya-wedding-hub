import { hasActiveBetaTrial, type BetaTrialLike } from '@/lib/betaTrial';

export type PlannerSubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

interface PlannerAccessRecord extends BetaTrialLike {
  planner_verified?: boolean | null;
  planner_subscription_status?: string | null;
  planner_subscription_expires_at?: string | null;
  planner_verification_requested?: boolean | null;
  planner_type?: string | null;
  committee_name?: string | null;
}

export function isCommitteePlanner(record?: PlannerAccessRecord | null) {
  return record?.planner_type === 'committee';
}

export function plannerHasActiveSubscription(record?: PlannerAccessRecord | null) {
  if (!record) return false;
  if (hasActiveBetaTrial(record)) return true;
  if (record.planner_subscription_status !== 'active') return false;
  if (!record.planner_subscription_expires_at) return true;
  return new Date(record.planner_subscription_expires_at).getTime() > Date.now();
}

export function plannerHasFullAccess(record?: PlannerAccessRecord | null) {
  return Boolean(record?.planner_verified && plannerHasActiveSubscription(record));
}

export function plannerAccessMessage(record?: PlannerAccessRecord | null) {
  if (hasActiveBetaTrial(record)) {
    return isCommitteePlanner(record)
      ? 'Your 14-day beta trial is active. Committee subscription-only features are unlocked while the trial runs.'
      : 'Your 14-day beta trial is active. Planner Pro features are unlocked while the trial runs.';
  }
  if (!plannerHasActiveSubscription(record)) {
    return isCommitteePlanner(record)
      ? 'Active committee subscription required before committee vendor and couple coordination unlocks.'
      : 'Active subscription required before planner connections and vendor outreach unlock.';
  }
  if (record?.planner_verification_requested && !record?.planner_verified) return 'Verification request is in admin review.';
  if (!record?.planner_verified) return isCommitteePlanner(record) ? 'Committee verification required.' : 'Verification required.';
  return isCommitteePlanner(record) ? 'Full committee access is active.' : 'Full planner access is active.';
}
