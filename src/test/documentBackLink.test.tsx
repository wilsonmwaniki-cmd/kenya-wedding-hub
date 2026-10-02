import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DocumentBackLink from '@/components/documents/DocumentBackLink';
const auth = vi.hoisted(() => ({ user: { id: 'user' } as { id: string } | null, profile: { role: 'couple' } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
afterEach(() => { cleanup(); auth.user = { id: 'user' }; auth.profile.role = 'couple'; });
function mount(state = {}) { render(<MemoryRouter initialEntries={[{ pathname: '/documents/share/token', state }]}><DocumentBackLink /></MemoryRouter>); }
describe('document back navigation', () => {
  it('returns couples to Documents even on a direct share link', () => {
    mount(); expect(screen.getByRole('link', { name: 'Back to Documents' })).toHaveAttribute('href', '/received-documents');
  });
  it('preserves the recipient inbox for a planner who came from it', () => {
    auth.profile.role = 'planner'; mount({ documentReturnTo: '/received-documents' });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/received-documents');
  });
  it('returns a vendor to their own Documents workspace', () => {
    auth.profile.role = 'vendor'; mount(); expect(screen.getByRole('link')).toHaveAttribute('href', '/vendor-documents');
  });
  it('leaves signed-out visitors a public home link', () => {
    auth.user = null; mount(); expect(screen.getByRole('link', { name: 'Back to Zania' })).toHaveAttribute('href', '/');
  });
  it('ignores arbitrary return destinations', () => {
    mount({ documentReturnTo: 'https://example.com' }); expect(screen.getByRole('link')).toHaveAttribute('href', '/received-documents');
  });
});
