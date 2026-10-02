import { describe, expect, it } from 'vitest';
import { getPasswordRecoveryRedirectUrl } from '@/lib/passwordRecovery';

describe('getPasswordRecoveryRedirectUrl', () => {
  it('always uses the canonical production reset URL from the apex domain', () => {
    expect(getPasswordRecoveryRedirectUrl({
      hostname: 'planwithzania.com',
      origin: 'https://planwithzania.com',
    })).toBe('https://www.planwithzania.com/reset-password?type=recovery');
  });

  it('keeps preview and local origins intact', () => {
    expect(getPasswordRecoveryRedirectUrl({
      hostname: 'localhost',
      origin: 'http://localhost:8080',
    })).toBe('http://localhost:8080/reset-password?type=recovery');
  });
});
