import { describe, expect, it } from 'vitest';
import {
  buildCommercialDocumentShareEmailDraft,
  commercialDocumentLatestQuoteResponse,
  commercialDocumentStatusLabel,
} from '@/lib/commercialDocuments';

describe('commercial document share email', () => {
  it.each(['quote', 'invoice', 'receipt'] as const)('includes the public link when sharing a %s', (documentType) => {
    const shareUrl = `https://www.planwithzania.com/documents/share/${documentType}-token`;
    const draft = buildCommercialDocumentShareEmailDraft({
      document: {
        documentNumber: 'DOC-2026-0001',
        title: 'Wedding photography',
        documentType,
        recipientName: 'Will Mwaniki',
        totalAmount: 15000,
        dueDate: null,
      },
      shareUrl,
    });

    expect(draft.body).toContain(`Open it here: ${shareUrl}`);
    expect(decodeURIComponent(draft.href)).toContain(shareUrl);
  });
});

describe('commercial quote responses', () => {
  it('labels the revision state clearly', () => {
    expect(commercialDocumentStatusLabel('changes_requested')).toBe('Changes requested');
  });

  it('reads the latest response stored with the quote', () => {
    expect(commercialDocumentLatestQuoteResponse({
      metadata: {
        latestQuoteResponse: {
          id: 'response-1',
          response: 'changes_requested',
          message: 'Please change coverage to 8 hours.',
          responderName: 'Amina',
          createdAt: '2026-09-05T07:00:00Z',
        },
      },
    })).toEqual({
      id: 'response-1',
      documentId: null,
      response: 'changes_requested',
      message: 'Please change coverage to 8 hours.',
      responderName: 'Amina',
      createdAt: '2026-09-05T07:00:00Z',
    });
  });
});
