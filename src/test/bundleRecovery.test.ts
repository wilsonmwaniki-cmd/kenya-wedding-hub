import { describe, expect, it } from 'vitest';
import { isRecoverableBundleError, resetBundleRecoveryAttempt } from '@/lib/bundleRecovery';

describe('isRecoverableBundleError', () => {
  it.each([
    'ChunkLoadError: Loading chunk 42 failed',
    'TypeError: Failed to fetch dynamically imported module',
    'Importing a module script failed',
    'Unable to preload CSS for /assets/dashboard.css',
  ])('recognizes deployment asset failures: %s', (message) => {
    expect(isRecoverableBundleError(new Error(message))).toBe(true);
  });

  it('does not reload for ordinary render failures', () => {
    expect(isRecoverableBundleError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('clears a previous recovery marker before an intentional navigation', () => {
    window.sessionStorage.setItem('zania:bundle-recovery-attempted', 'previous-attempt');

    resetBundleRecoveryAttempt();

    expect(window.sessionStorage.getItem('zania:bundle-recovery-attempted')).toBeNull();
  });
});
