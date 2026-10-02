import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import GuestCheckIn from '@/components/guests/GuestCheckIn';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const confirmedGuest = {
  id: 'confirmed-guest',
  name: 'Amina Guest',
  email: null,
  rsvp_status: 'confirmed',
  group_name: null,
  category: null,
  wedding_id: 'wedding-1',
  checked_in: false,
  checked_in_at: null,
};

const declinedGuest = {
  ...confirmedGuest,
  id: 'declined-guest',
  name: 'Declined Guest',
  rsvp_status: 'declined',
};

describe('GuestCheckIn', () => {
  it('exposes labelled controls and only lists confirmed guests', () => {
    render(
      <GuestCheckIn
        guests={[confirmedGuest, declinedGuest]}
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Guest check-in' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search confirmed guests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close check-in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check in Amina Guest' })).toBeInTheDocument();
    expect(screen.queryByText('Declined Guest')).not.toBeInTheDocument();
  });
});
