import { describe, expect, it } from 'vitest';
import { validateExternalContractFile } from '@/lib/externalContracts';
import {
  normalizeExternalContractExtraction,
  parseExternalContractResponse,
} from '../../supabase/functions/_shared/externalContractAnalysis';

describe('external contract ingestion', () => {
  it('accepts a bounded PDF and rejects unsupported or oversized files', () => {
    expect(validateExternalContractFile({ name: 'vendor-contract.pdf', type: 'application/pdf', size: 2000 })).toBeNull();
    expect(validateExternalContractFile({ name: 'vendor-contract.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 2000 })).toContain('PDF');
    expect(validateExternalContractFile({ name: 'vendor-contract.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 })).toContain('10 MB');
  });

  it('normalizes extracted facts without inventing malformed money or dates', () => {
    const facts = normalizeExternalContractExtraction({
      vendorName: ' Coast Film Studio ', currency: 'kes', totalAmount: '250000', depositAmount: 'not recorded',
      eventDate: 'next June', paymentSchedule: [
        { title: ' Deposit ', amount: '100000', dueDate: '2026-12-01', confidence: 1.4 },
        { title: 'Balance', amount: '150,000', dueDate: '2027-05-01', confidence: 0.8 },
      ], serviceScope: ['Photography'], unknowns: ['Exact event date'], overallConfidence: 0.74,
    });
    expect(facts).toMatchObject({ vendorName: 'Coast Film Studio', currency: 'KES', totalAmount: '250000', depositAmount: null, eventDate: null, overallConfidence: 0.74 });
    expect(facts.paymentSchedule).toEqual([{ title: 'Deposit', amount: '100000', dueDate: '2026-12-01', confidence: 1 }]);
  });

  it('parses structured Responses API output', () => {
    const extraction = parseExternalContractResponse({
      id: 'resp_1', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
        vendorName: 'Coast Film Studio', clientName: null, eventDate: '2027-05-14', location: 'Nairobi',
        currency: 'KES', totalAmount: '250000', depositAmount: '100000', paymentSchedule: [],
        serviceScope: ['Photography'], deliverables: [], cancellation: null, postponement: null,
        forceMajeure: null, overtime: null, travel: null, termination: null, disputeResolution: null,
        unknowns: [], overallConfidence: 0.9,
      }) }] }],
    });
    expect(extraction).toMatchObject({ vendorName: 'Coast Film Studio', eventDate: '2027-05-14', totalAmount: '250000' });
  });
});
