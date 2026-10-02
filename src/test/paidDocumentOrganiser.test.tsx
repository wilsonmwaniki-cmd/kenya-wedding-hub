import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import PaidDocumentOrganiser from '@/components/documents/PaidDocumentOrganiser';
import type { OrganisedDocument } from '@/lib/documentOrganiser';

const quote = (id: string): OrganisedDocument => ({ id, document_type:'quote', document_number:id, title:id, status:'sent', currency:'KES', total_amount:1000, updated_at:'2026-09-09', share_token:id, professional_id:'vendor', professional_name:'Vendor', professional_role:'vendor', source_id:null, due_date:null, amount_paid:0, balance_due:0, items:[] });
describe('document organiser views', () => {
  it('limits quote comparison to three and allows deselection', () => {
    render(<MemoryRouter><PaidDocumentOrganiser data={{enabled:true,documents:['one','two','three','four'].map(quote),events:[]}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Compare quotes'}));
    const boxes = screen.getAllByRole('checkbox');
    boxes.slice(0,3).forEach(box=>fireEvent.click(box));
    expect(boxes[3]).toBeDisabled();
    fireEvent.click(boxes[0]);
    expect(boxes[3]).not.toBeDisabled();
  });
  it('shows outstanding invoices in the calendar with document links', () => {
    render(<MemoryRouter><PaidDocumentOrganiser data={{enabled:true,documents:[{...quote('INV-1'),document_type:'invoice',balance_due:500,due_date:'2026-10-01'}],events:[]}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button',{name:'Payment calendar'}));
    expect(screen.getByText('2026-10-01')).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'INV-1'})).toHaveAttribute('href','/documents/share/INV-1');
    expect(screen.getByText('KES 500')).toBeInTheDocument();
  });
});
