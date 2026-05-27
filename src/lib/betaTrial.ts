export const BETA_TRIAL_DURATION_DAYS = 14;

export type BetaTrialStatus = 'inactive' | 'active' | 'expired' | 'cancelled';

export interface BetaTrialLike {
  beta_trial_status?: string | null;
  beta_trial_started_at?: string | null;
  beta_trial_expires_at?: string | null;
}

export function hasActiveBetaTrial(record?: BetaTrialLike | null) {
  if (!record) return false;
  if (record.beta_trial_status !== 'active') return false;
  if (!record.beta_trial_expires_at) return false;
  return new Date(record.beta_trial_expires_at).getTime() > Date.now();
}

export function shouldStartBetaTrial(record?: BetaTrialLike | null) {
  if (!record) return true;

  return (
    (record.beta_trial_status == null || record.beta_trial_status === 'inactive')
    && !record.beta_trial_started_at
    && !record.beta_trial_expires_at
  );
}

export function buildBetaTrialWindow(now = new Date()) {
  const startedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + BETA_TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  return {
    beta_trial_status: 'active' as const,
    beta_trial_started_at: startedAt,
    beta_trial_expires_at: expiresAt,
  };
}
