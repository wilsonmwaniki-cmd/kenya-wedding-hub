import { describe, expect, it } from 'vitest';
import { formatIntegerInput, parseIntegerInput } from '@/lib/integerInput';

describe('integer inputs', () => {
  it('shows thousands separators for budget and guest values', () => {
    expect(formatIntegerInput(2_500_000)).toBe('2,500,000');
    expect(formatIntegerInput(1_200)).toBe('1,200');
  });

  it('turns formatted values back into numbers used by the plan', () => {
    expect(parseIntegerInput('2,500,000')).toBe(2_500_000);
    expect(parseIntegerInput('')).toBe(0);
  });
});
