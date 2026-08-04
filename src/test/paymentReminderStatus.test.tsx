import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaymentReminderStatus } from '@/components/PaymentReminderStatus';

describe('PaymentReminderStatus', () => {
  it('opens the linked date picker when a saved reminder is clicked', () => {
    const showPicker = vi.fn();
    render(
      <>
        <input id="payment-date" type="date" ref={(input) => {
          if (input) input.showPicker = showPicker;
        }} />
        <PaymentReminderStatus
          dueDate="2026-08-31"
          vendorName="Keky Tamu"
          saved
          inputId="payment-date"
        />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /change payment reminder/i }));

    expect(document.activeElement).toBe(document.getElementById('payment-date'));
    expect(showPicker).toHaveBeenCalledOnce();
  });

  it('opens the linked date picker from the empty state', () => {
    const showPicker = vi.fn();
    render(
      <>
        <input id="empty-payment-date" type="date" ref={(input) => {
          if (input) input.showPicker = showPicker;
        }} />
        <PaymentReminderStatus inputId="empty-payment-date" />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: /schedule a payment reminder/i }));

    expect(showPicker).toHaveBeenCalledOnce();
  });
});
