export type PlannerSubscriptionStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

interface PlannerAccessRecord {
  planner_verified?: boolean | null;
  planner_subscription_status?: string | null;
  planner_subscription_expires_at?: string | null;
  planner_verification_requested?: boolean | null;
}

export function plannerHasActiveSubscription(record?: PlannerAccessRecord | null) {
  if (!record) return false;
  if (record.planner_subscription_status !== 'active') return false;
  if (!record.planner_subscription_expires_at) return true;
  return new Date(record.planner_subscription_expires_at).getTime() > Date.now();
}

export function plannerHasFullAccess(record?: PlannerAccessRecord | null) {
  return Boolean(record?.planner_verified && plannerHasActiveSubscription(record));
}

export function plannerAccessMessage(record?: PlannerAccessRecord | null) {
  if (!plannerHasActiveSubscription(record)) return 'Active subscription required before planner connections and vendor outreach unlock.';
  if (record?.planner_verification_requested && !record?.planner_verified) return 'Verification request is in admin review.';
  if (!record?.planner_verified) return 'Verification required.';
  return 'Full planner access is active.';
}
