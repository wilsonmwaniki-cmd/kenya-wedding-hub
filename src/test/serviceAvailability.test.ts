import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getServiceAvailabilitySnapshot,
  isMonitoredServiceUrl,
  isServiceFailureStatus,
  reportServiceFailure,
  reportServiceRecovery,
  resetServiceAvailabilityForTests,
} from '@/lib/serviceAvailability';

describe('service availability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetServiceAvailabilityForTests();
  });

  afterEach(() => {
    resetServiceAvailabilityForTests();
    vi.useRealTimers();
  });

  it('raises a delayed failure and clears it after recovery', () => {
    reportServiceFailure('backend');
    expect(getServiceAvailabilitySnapshot().available).toBe(true);

    vi.advanceTimersByTime(600);
    expect(getServiceAvailabilitySnapshot()).toMatchObject({
      available: false,
      reason: 'backend',
    });

    reportServiceRecovery();
    expect(getServiceAvailabilitySnapshot()).toEqual({
      available: true,
      reason: null,
      failedAt: null,
    });
  });

  it('does not flash a failure when a retry succeeds quickly', () => {
    reportServiceFailure('backend');
    reportServiceRecovery();
    vi.advanceTimersByTime(600);
    expect(getServiceAvailabilitySnapshot().available).toBe(true);
  });

  it('only monitors Zania backend services and actionable failure statuses', () => {
    expect(isMonitoredServiceUrl(
      'https://example.supabase.co/rest/v1/profiles',
      'https://example.supabase.co',
    )).toBe(true);
    expect(isMonitoredServiceUrl(
      'https://other.supabase.co/rest/v1/profiles',
      'https://example.supabase.co',
    )).toBe(false);
    expect(isServiceFailureStatus(401)).toBe(true);
    expect(isServiceFailureStatus(503)).toBe(true);
    expect(isServiceFailureStatus(400)).toBe(false);
  });
});
