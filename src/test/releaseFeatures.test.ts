import { describe, expect, it } from 'vitest';
import { isPathEnabledForRelease, resolveReleaseChannel } from '@/lib/featureFlags';

describe('launch feature release controls', () => {
  it('fails closed to production when no release channel is configured', () => {
    expect(resolveReleaseChannel(undefined, false)).toBe('production');
  });

  it('keeps only the launch workspace active in production', () => {
    ['/dashboard', '/budget', '/tasks', '/vendors', '/settings'].forEach((path) => {
      expect(isPathEnabledForRelease(path, 'production')).toBe(true);
    });

    ['/guests', '/contributions', '/gift-registry', '/timeline', '/portfolio', '/ai-chat'].forEach((path) => {
      expect(isPathEnabledForRelease(path, 'production')).toBe(false);
    });
  });

  it('allows every route on staging', () => {
    ['/dashboard', '/guests', '/timeline', '/ai-chat', '/anything-new'].forEach((path) => {
      expect(isPathEnabledForRelease(path, 'staging')).toBe(true);
    });
  });
});
