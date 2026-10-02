import { describe, expect, it } from 'vitest';
import { compileContractSections, hydrateContractSections, syncSectionsFromTerms } from '@/lib/contractSections';

describe('contract sections', () => {
  it('moves existing plain contract terms beneath their matching section titles', () => {
    const sections = hydrateContractSections(
      [{ description: 'Time frame' }, { description: 'Payment' }],
      'Time frame\nDelivery takes 4 - 6 weeks.\n\nPayment\nA 50% deposit confirms the booking.',
    );

    expect(sections).toEqual([
      expect.objectContaining({ description: 'Time frame', content: 'Delivery takes 4 - 6 weeks.' }),
      expect.objectContaining({ description: 'Payment', content: 'A 50% deposit confirms the booking.' }),
    ]);
  });

  it('compiles titled sections into formatted standard terms', () => {
    expect(compileContractSections([
      { description: 'Time frame', content: 'Delivery takes **4 - 6 weeks**.' },
      { description: 'Payment', content: 'A *50% deposit* confirms the booking.' },
    ])).toBe('## Time frame\n\nDelivery takes **4 - 6 weeks**.\n\n## Payment\n\nA *50% deposit* confirms the booking.');
  });

  it('updates section content after editing the combined standard terms', () => {
    const sections = syncSectionsFromTerms(
      [{ description: 'Payment', content: 'Old wording' }],
      '## Payment\n\n**New wording**',
    );

    expect(sections[0].content).toBe('**New wording**');
  });
});
