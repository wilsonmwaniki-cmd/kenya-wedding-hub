import { describe, expect, it } from 'vitest';
import { formatCurrencyInputText, formatCurrencyInputValue, parseCurrencyInput, sanitizeCurrencyInputText } from '@/lib/currencyInput';

describe('document currency input', () => {
  it('adds thousands separators while the user types', () => {
    expect(formatCurrencyInputText('15000')).toBe('15,000');
    expect(formatCurrencyInputText('1,250,000')).toBe('1,250,000');
  });

  it('accepts pasted currency text and keeps two decimal places', () => {
    expect(formatCurrencyInputText('KES 12500.75')).toBe('12,500.75');
    expect(parseCurrencyInput('12,500.75')).toBe(12500.75);
  });

  it('does not insert separators while a person is editing', () => {
    expect(sanitizeCurrencyInputText('15000')).toBe('15000');
    expect(sanitizeCurrencyInputText('KES 12500.756')).toBe('12500.75');
  });

  it('shows an empty field instead of a blocking zero', () => {
    expect(formatCurrencyInputValue(0)).toBe('');
    expect(formatCurrencyInputValue(35000)).toBe('35,000');
  });
});
