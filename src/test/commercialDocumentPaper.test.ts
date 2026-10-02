import { describe, expect, it } from 'vitest';
import { commercialDocumentDateFields } from '@/lib/commercialDocumentPresentation';

describe('commercial document paper', () => {
  it.each([
    ['quote', 'Valid until'],
    ['invoice', 'Due date'],
  ] as const)('uses the correct secondary date for a %s', (documentType, expectedLabel) => {
    const fields = commercialDocumentDateFields({
      documentType,
      issueDate: '2026-08-31',
      dueDate: '2026-09-07',
      paidDate: null,
    });

    expect(fields.map((field) => field.label)).toEqual(['Issue date', expectedLabel]);
  });

  it('uses the payment date first for a receipt', () => {
    const fields = commercialDocumentDateFields({
      documentType: 'receipt',
      issueDate: '2026-08-31',
      dueDate: null,
      paidDate: '2026-08-30',
    });

    expect(fields.map((field) => field.label)).toEqual(['Payment date', 'Issue date']);
    expect(fields[0].value).toContain('30 Aug 2026');
  });
});
