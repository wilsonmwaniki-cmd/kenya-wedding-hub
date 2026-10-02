import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import QuantityInput from '@/components/documents/QuantityInput';

function QuantityHarness() {
  const [quantity, setQuantity] = useState(1);
  return <QuantityInput aria-label="Quantity" value={quantity} onValueChange={setQuantity} />;
}

describe('document quantity input', () => {
  it('can be cleared and replaced with zero', () => {
    render(<QuantityHarness />);
    const input = screen.getByLabelText('Quantity') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: '0' } });
    expect(input.value).toBe('0');

    fireEvent.blur(input);
    expect(input.value).toBe('0');
  });

  it('accepts a fractional quantity after clearing the existing value', () => {
    render(<QuantityHarness />);
    const input = screen.getByLabelText('Quantity') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.blur(input);

    expect(input.value).toBe('2.5');
  });
});
