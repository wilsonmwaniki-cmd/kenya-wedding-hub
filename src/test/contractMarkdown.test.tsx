import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ContractTermsContent from '@/components/documents/ContractTermsContent';

describe('contract rich text', () => {
  it('renders headings, bold text, and italic text instead of Markdown symbols', () => {
    render(<ContractTermsContent terms={'## Payment\n\nPay the **deposit** before the *event date*.'} />);

    expect(screen.getByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByText('deposit').tagName).toBe('STRONG');
    expect(screen.getByText('event date').tagName).toBe('EM');
    expect(screen.queryByText('## Payment')).not.toBeInTheDocument();
  });

  it('preserves single editor line breaks in contract paragraphs', () => {
    render(<ContractTermsContent terms={'The assignment will involve:\nProvide photography services\n2 photographers will be provided'} />);

    const paragraph = screen.getByText(/The assignment will involve:/);
    expect(paragraph).toHaveClass('whitespace-pre-wrap');
    expect(paragraph.textContent).toBe('The assignment will involve:\nProvide photography services\n2 photographers will be provided');
  });
});
