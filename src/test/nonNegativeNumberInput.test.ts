import { describe, expect, it } from 'vitest';
import {
  formatNonNegativeNumberInputText,
  formatNonNegativeNumberInputValue,
  parseNonNegativeNumberInput,
} from '@/lib/nonNegativeNumberInput';

describe('non-negative document number input', () => {
  it('allows a field to be temporarily empty without restoring its previous value', () => {
    expect(formatNonNegativeNumberInputText('')).toBe('');
    expect(parseNonNegativeNumberInput('')).toBe(0);
  });

  it('preserves an intentional zero', () => {
    expect(formatNonNegativeNumberInputText('0')).toBe('0');
    expect(parseNonNegativeNumberInput('0')).toBe(0);
    expect(formatNonNegativeNumberInputValue(0)).toBe('0');
  });

  it('supports fractional quantities to two decimal places', () => {
    expect(formatNonNegativeNumberInputText('1.255')).toBe('1.25');
    expect(parseNonNegativeNumberInput('1.25')).toBe(1.25);
  });

  it('does not accept negative quantities', () => {
    expect(formatNonNegativeNumberInputText('-4')).toBe('4');
    expect(parseNonNegativeNumberInput('-4')).toBe(0);
  });
});
