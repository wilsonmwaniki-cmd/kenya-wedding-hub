import { describe, expect, it } from 'vitest';

import { createSecurePassword, validatePasswordRequirements } from '@/lib/passwords';

describe('createSecurePassword', () => {
  it('always includes lowercase, uppercase, a digit, and a symbol', () => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const password = createSecurePassword();

      expect(password).toHaveLength(16);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[!@#$%^&*]/);
    }
  });
});

describe('validatePasswordRequirements', () => {
  it('accepts passwords that satisfy the live auth policy', () => {
    expect(validatePasswordRequirements('Abcd1234!')).toBeNull();
  });

  it('explains when a password is missing a number', () => {
    expect(validatePasswordRequirements('Abcdefgh!')).toContain('number');
  });
});
