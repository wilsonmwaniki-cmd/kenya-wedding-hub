import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExploreZania from '@/pages/ExploreZania';
import { startDemoSession } from '@/lib/demoSessions';
import type { User } from '@supabase/supabase-js';

const auth = vi.hoisted(() => ({
  user: null as User | null,
  profile: null as { role: 'couple' | 'planner' | 'vendor'; planner_type: 'professional' | 'committee' | null } | null,
  loading: false,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/demoSessions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/demoSessions')>();
  return { ...original, startDemoSession: vi.fn(() => new Promise(() => undefined)) };
});

describe('Explore Zania role demos', () => {
  beforeEach(() => {
    auth.user = null;
    auth.profile = null;
    auth.loading = false;
    vi.mocked(startDemoSession).mockClear();
  });

  it('offers the three real application demo roles', () => {
    render(<MemoryRouter><ExploreZania /></MemoryRouter>);

    expect(screen.getByRole('tab', { name: 'Couple' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Professional' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Planner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try as couple/i })).toBeInTheDocument();
    expect(screen.getByText(/real Zania interface/i)).toBeInTheDocument();
  });

  it('starts an isolated demo for the selected role', () => {
    render(<MemoryRouter><ExploreZania /></MemoryRouter>);

    fireEvent.click(screen.getByRole('tab', { name: 'Planner' }));
    fireEvent.click(screen.getByRole('button', { name: /try as planner/i }));
    expect(startDemoSession).toHaveBeenCalledWith('planner');
    expect(screen.getByRole('button', { name: /preparing workspace/i })).toBeDisabled();
  });

  it('keeps a signed-in real account separate from demos', () => {
    auth.user = { id: 'real-user', email: 'member@example.com', is_anonymous: false, app_metadata: { provider: 'email' } };
    auth.profile = { role: 'couple', planner_type: null };
    render(<MemoryRouter><ExploreZania /></MemoryRouter>);

    expect(screen.getByText(/you are already signed in/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /return to my workspace/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('button', { name: /try the couple demo/i })).not.toBeInTheDocument();
  });
});
