import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDocumentAutosave } from '@/hooks/useDocumentAutosave';
import {
  buildCommercialDocumentAutosaveSnapshot,
  calculateCommercialDocumentDraftTotals,
} from '@/lib/commercialDocumentAutosave';

function AutosaveHarness({
  documentId,
  title,
  save,
}: {
  documentId: string;
  title: string;
  save: (value: { title: string }) => Promise<void>;
}) {
  const autosave = useDocumentAutosave({
    documentId,
    enabled: true,
    value: { title },
    save,
    delay: 100,
  });

  return (
    <>
      <span>{autosave.status}</span>
      <button type="button" onClick={autosave.flush}>Flush</button>
    </>
  );
}

describe('document autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not save the initial server snapshot', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(<AutosaveHarness documentId="doc-1" title="Original" save={save} />);

    await act(async () => vi.advanceTimersByTime(200));

    expect(save).not.toHaveBeenCalled();
    expect(screen.getByText('saved')).toBeInTheDocument();
  });

  it('debounces edits and saves the latest snapshot', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const view = render(<AutosaveHarness documentId="doc-1" title="Original" save={save} />);

    view.rerender(<AutosaveHarness documentId="doc-1" title="First edit" save={save} />);
    await act(async () => vi.advanceTimersByTime(50));
    view.rerender(<AutosaveHarness documentId="doc-1" title="Latest edit" save={save} />);
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ title: 'Latest edit' });
    expect(screen.getByText('saved')).toBeInTheDocument();
  });

  it('preserves incomplete draft rows in the autosave snapshot', () => {
    const snapshot = buildCommercialDocumentAutosaveSnapshot({
      title: 'Draft quote',
      recipientName: '',
      recipientEmail: '',
      recipientPhone: '',
      weddingName: '',
      issueDate: '2026-09-16',
      dueDate: '2026-09-23',
      notes: '',
      terms: '',
      discountAmount: 0,
      taxAmount: 0,
      paymentInstructions: '',
      authorisedBy: '',
    }, [{ description: '', quantity: 0, unitPrice: 1500 }]);

    expect(snapshot.items).toEqual([{
      description: '',
      quantity: 0,
      unitPrice: 1500,
      sortOrder: 0,
      metadata: {},
    }]);
    expect(calculateCommercialDocumentDraftTotals(snapshot)).toEqual({
      subtotal: 0,
      totalAmount: 0,
    });
  });

  it('flushes pending changes when the editor loses focus', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const view = render(<AutosaveHarness documentId="doc-1" title="Original" save={save} />);
    view.rerender(<AutosaveHarness documentId="doc-1" title="Leaving now" save={save} />);

    await act(async () => {
      screen.getByRole('button', { name: 'Flush' }).click();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith({ title: 'Leaving now' });
  });
});
