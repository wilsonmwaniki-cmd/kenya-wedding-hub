import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SegmentedNav, type SegmentedNavItem } from '@/components/SegmentedNav';

const items: SegmentedNavItem[] = [
  { id: 'overview', label: 'Overview', href: '/overview', icon: <svg data-testid="overview-icon" /> },
  { id: 'budget', label: 'Budget', href: '/budget' },
  { id: 'guests', label: 'Guests', href: '/guests', disabled: true },
  { id: 'vendors', label: 'Vendors', href: '/vendors' },
];

function SegmentedNavHarness({ showIcons = true }: { showIcons?: boolean }) {
  const [value, setValue] = useState('overview');

  return (
    <MemoryRouter initialEntries={['/overview']}>
      <SegmentedNav
        ariaLabel="Wedding workspace sections"
        items={items}
        value={value}
        onValueChange={setValue}
        showIcons={showIcons}
      />
    </MemoryRouter>
  );
}

describe('SegmentedNav', () => {
  it('uses a roving tab stop and selects the next enabled item with ArrowRight', () => {
    render(<SegmentedNavHarness />);

    const overview = screen.getByRole('tab', { name: 'Overview' });
    const budget = screen.getByRole('tab', { name: 'Budget' });

    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(overview).toHaveAttribute('tabindex', '0');
    expect(budget).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(overview, { key: 'ArrowRight' });

    expect(budget).toHaveFocus();
    expect(budget).toHaveAttribute('aria-selected', 'true');
    expect(budget).toHaveAttribute('tabindex', '0');
  });

  it('skips disabled items and supports Home and End', () => {
    render(<SegmentedNavHarness />);

    const overview = screen.getByRole('tab', { name: 'Overview' });
    const budget = screen.getByRole('tab', { name: 'Budget' });
    const vendors = screen.getByRole('tab', { name: 'Vendors' });

    fireEvent.keyDown(overview, { key: 'End' });
    expect(vendors).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(vendors, { key: 'Home' });
    expect(overview).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(budget, { key: 'ArrowRight' });
    expect(vendors).toHaveAttribute('aria-selected', 'true');
  });

  it('can hide icons without changing the navigation labels', () => {
    render(<SegmentedNavHarness showIcons={false} />);

    expect(screen.queryByTestId('overview-icon')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
  });
});
