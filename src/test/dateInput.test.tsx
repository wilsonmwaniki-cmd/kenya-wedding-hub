import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Input } from '@/components/ui/input';

describe('Zania date input', () => {
  it('shows ISO values as day, month, year', () => {
    render(<Input type="date" value="2026-08-31" onChange={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Selected date 31/08/2026' })).toHaveTextContent('31/08/2026');
  });

  it('opens in a viewport-safe dialog instead of a position-flipping popover', () => {
    render(<Input type="date" value="2026-08-31" onChange={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'Selected date 31/08/2026' }));

    expect(screen.getByRole('dialog')).toHaveClass('max-h-[calc(100dvh-1.5rem)]');
    expect(screen.getByRole('dialog')).toHaveClass('max-w-[22rem]');
    expect(screen.getByRole('heading', { name: 'Choose a date' })).toBeVisible();
  });

  it('keeps emitting ISO dates to existing form handlers', () => {
    let emittedValue = '';
    const onChange = vi.fn((event: React.ChangeEvent<HTMLInputElement>) => {
      emittedValue = event.target.value;
    });
    render(<Input type="date" value="2026-08-31" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Selected date 31/08/2026' }));
    fireEvent.click(screen.getByRole('gridcell', { name: '15' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(emittedValue).toBe('2026-08-15');
  });
});
