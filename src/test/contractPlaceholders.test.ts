import { describe, expect, it } from 'vitest';
import { getContractPlaceholders } from '@/lib/contractPlaceholders';

describe('getContractPlaceholders', () => {
  it('finds unfinished details in the summary and terms', () => {
    const placeholders = getContractPlaceholders({
      summary: 'Photography at [enter venue].',
      terms: 'Total fee: KES [amount]. Due [date].',
    });

    expect(placeholders.map((item) => [item.field, item.label])).toEqual([
      ['summary', 'Venue'],
      ['terms', 'Amount'],
      ['terms', 'Date'],
    ]);
  });

  it('returns the exact selection range for each detail', () => {
    const [placeholder] = getContractPlaceholders({ summary: '', terms: 'Pay [KES amount] now.' });

    expect(placeholder.raw).toBe('[KES amount]');
    expect('Pay [KES amount] now.'.slice(placeholder.start, placeholder.end)).toBe('[KES amount]');
  });

  it('ignores empty brackets and text across lines', () => {
    expect(getContractPlaceholders({ summary: 'Keep []', terms: 'Keep [two\nlines]' })).toEqual([]);
  });
});
