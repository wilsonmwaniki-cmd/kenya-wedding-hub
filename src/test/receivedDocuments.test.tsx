import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReceivedDocuments from '@/pages/ReceivedDocuments';
import { receivedDocumentPath, type ReceivedDocument } from '@/lib/receivedDocuments';

const state = vi.hoisted(() => ({ data: [] as unknown[], isPending: false, isError: false, refetch: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => state }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'recipient', email: 'recipient@example.com' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useDocumentOrganiser', () => ({ useDocumentOrganiser: () => ({ data: { enabled: false }, pending: false }) }));
const invoice: ReceivedDocument = { id: 'invoice', document_type: 'invoice', document_number: 'INV-2026-0005', title: 'Wedding invoice', status: 'sent', currency: 'KES', total_amount: 1000, updated_at: '', share_token: 'abc' };
afterEach(() => { cleanup(); state.data = []; state.isPending = false; state.isError = false; });
function mount() { render(<MemoryRouter><ReceivedDocuments /></MemoryRouter>); }
describe('received documents', () => {
  it('opens invoices on the existing share/payment page', () => {
    state.data = [invoice]; mount();
    expect(screen.getByRole('link', { name: 'Open Wedding invoice' })).toHaveAttribute('href', '/documents/share/abc');
    expect(screen.getByText('KES 1,000')).toBeInTheDocument();
  });
  it('routes contracts to their signing page', () => {
    expect(receivedDocumentPath({ ...invoice, document_type: 'contract' })).toBe('/contracts/share/abc');
  });
  it('explains recipient email matching when empty', () => {
    mount(); expect(screen.getByText('No shared documents yet')).toBeInTheDocument();
    expect(screen.getByText('Sent to: recipient@example.com')).toBeInTheDocument();
  });
  it('shows a retry instead of an empty inbox when loading fails', () => {
    state.isError = true; mount();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
