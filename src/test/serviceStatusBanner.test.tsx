import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ServiceStatusBanner from '@/components/ServiceStatusBanner';
import {
  reportServiceFailure,
  reportServiceRecovery,
  resetServiceAvailabilityForTests,
} from '@/lib/serviceAvailability';

describe('ServiceStatusBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetServiceAvailabilityForTests();
  });

  afterEach(() => {
    cleanup();
    resetServiceAvailabilityForTests();
    vi.useRealTimers();
  });

  it('explains a service failure and clears when service recovers', () => {
    render(<ServiceStatusBanner />);

    act(() => {
      reportServiceFailure('backend');
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Some Zania services are temporarily unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Previously saved information is safe');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    act(() => reportServiceRecovery());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
