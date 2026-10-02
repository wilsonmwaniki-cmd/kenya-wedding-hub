import { beforeEach, describe, expect, it } from 'vitest';
import {
  consumeOAuthConsentReturn,
  getOAuthConsentPath,
  rememberOAuthConsentReturn,
} from '@/lib/oauthConsent';

describe('OAuth consent return routing', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('builds a bounded consent path and preserves it across sign-in', () => {
    const path = getOAuthConsentPath('authorization-request');
    expect(path).toBe('/oauth/consent?authorization_id=authorization-request');
    rememberOAuthConsentReturn(path!);
    expect(consumeOAuthConsentReturn()).toBe(path);
    expect(consumeOAuthConsentReturn()).toBeNull();
  });

  it('rejects missing, oversized, or unrelated return paths', () => {
    expect(getOAuthConsentPath('')).toBeNull();
    expect(getOAuthConsentPath('x'.repeat(513))).toBeNull();
    rememberOAuthConsentReturn('/dashboard');
    expect(consumeOAuthConsentReturn()).toBeNull();
  });
});
