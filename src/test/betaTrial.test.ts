import { describe, expect, it } from 'vitest';

import { hasActiveBetaTrial, inactiveBetaTrialState } from '@/lib/betaTrial';

describe('legacy beta trial handling', () => {
  it('keeps new accounts outside the retired trial', () => {
    expect(inactiveBetaTrialState).toEqual({
      beta_trial_status: 'inactive',
      beta_trial_started_at: null,
      beta_trial_expires_at: null,
    });
    expect(hasActiveBetaTrial(inactiveBetaTrialState)).toBe(false);
  });

  it('continues honoring an unexpired trial granted before retirement', () => {
    expect(hasActiveBetaTrial({
      beta_trial_status: 'active',
      beta_trial_expires_at: new Date(Date.now() + 60_000).toISOString(),
    })).toBe(true);
  });
});
