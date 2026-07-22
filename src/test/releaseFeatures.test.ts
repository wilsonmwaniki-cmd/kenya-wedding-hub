import { describe, expect, it } from 'vitest';
import { isPathEnabledForRelease, resolveReleaseChannel } from '@/lib/featureFlags';

describe('launch feature release controls', () => {
  it('fails closed to production when no release channel is configured', () => {
    expect(resolveReleaseChannel(undefined, false)).toBe('production');
  });

  it('keeps the couple workspace and safe professional entry routes active in production', () => {
    ['/clients', '/dashboard', '/budget', '/tasks', '/vendors', '/vendor-dashboard', '/vendor-settings', '/settings'].forEach((path) => {
      expect(isPathEnabledForRelease(path, 'production')).toBe(true);
    });

    ['/guests', '/contributions', '/gift-registry', '/timeline', '/portfolio', '/ai-chat', '/planner-documents', '/vendor-documents'].forEach((path) => {
      expect(isPathEnabledForRelease(path, 'production')).toBe(false);
    });
  });

  it('allows every route on staging', () => {
    ['/dashboard', '/guests', '/timeline', '/ai-chat', '/anything-new'].forEach((path) => {
      expect(isPathEnabledForRelease(path, 'staging')).toBe(true);
    });
  });
});
