import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AssistantActionReview from '@/components/AssistantActionReview';

describe('AssistantActionReview', () => {
  it('keeps proposed writes pending until the user confirms', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <AssistantActionReview
        actions={[{
          toolName: 'create_task',
          args: { title: 'Confirm caterer numbers' },
          summary: 'Create task "Confirm caterer numbers"',
          destructive: false,
        }]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Nothing has changed yet. Confirm only if every action below looks right.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run this action' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('lets the user decline a destructive proposal', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <AssistantActionReview
        actions={[{
          toolName: 'remove_guest',
          args: { name: 'Example guest' },
          summary: 'Remove guest "Example guest"',
          destructive: true,
        }]}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Destructive')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Not yet' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
