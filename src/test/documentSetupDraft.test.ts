import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDocumentSetupDraft,
  readDocumentSetupDraft,
  writeDocumentSetupDraft,
} from '@/lib/documentSetupDraft';

describe('document setup draft recovery', () => {
  afterEach(() => window.localStorage.clear());

  it('keeps drafts separate by account, role, and document type', () => {
    writeDocumentSetupDraft('user-a', 'vendor', 'quote', { title: 'Vendor quote' });
    writeDocumentSetupDraft('user-a', 'planner', 'quote', { title: 'Planner quote' });
    writeDocumentSetupDraft('user-a', 'vendor', 'invoice', { title: 'Vendor invoice' });

    expect(readDocumentSetupDraft<{ title: string }>('user-a', 'vendor', 'quote')?.title).toBe('Vendor quote');
    expect(readDocumentSetupDraft<{ title: string }>('user-a', 'planner', 'quote')?.title).toBe('Planner quote');
    expect(readDocumentSetupDraft<{ title: string }>('user-a', 'vendor', 'invoice')?.title).toBe('Vendor invoice');
    expect(readDocumentSetupDraft('user-b', 'vendor', 'quote')).toBeNull();
  });

  it('clears a completed setup draft without affecting another type', () => {
    writeDocumentSetupDraft('user-a', 'vendor', 'quote', { title: 'Quote' });
    writeDocumentSetupDraft('user-a', 'vendor', 'invoice', { title: 'Invoice' });

    clearDocumentSetupDraft('user-a', 'vendor', 'quote');

    expect(readDocumentSetupDraft('user-a', 'vendor', 'quote')).toBeNull();
    expect(readDocumentSetupDraft<{ title: string }>('user-a', 'vendor', 'invoice')?.title).toBe('Invoice');
  });

  it('ignores corrupted saved data', () => {
    window.localStorage.setItem('zania:document-setup-draft:v1:user-a:vendor:quote', '{bad json');
    expect(readDocumentSetupDraft('user-a', 'vendor', 'quote')).toBeNull();
  });
});
