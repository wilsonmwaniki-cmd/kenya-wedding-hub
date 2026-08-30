export type BetaTrialStatus = 'inactive' | 'active' | 'expired' | 'cancelled';

export const inactiveBetaTrialState = {
  beta_trial_status: 'inactive' as const,
  beta_trial_started_at: null,
  beta_trial_expires_at: null,
};

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
