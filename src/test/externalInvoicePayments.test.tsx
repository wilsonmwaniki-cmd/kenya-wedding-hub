import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ExternalPaymentReportDialog from '@/components/documents/ExternalPaymentReportDialog';
import ExternalPaymentReportsPanel from '@/components/documents/ExternalPaymentReportsPanel';
import type { SharedCommercialDocument } from '@/lib/commercialDocuments';

const listRecipient = vi.fn().mockResolvedValue([]);
const listOwner = vi.fn().mockResolvedValue([{id:'report',documentId:'invoice',amount:500,paymentDate:'2026-09-09',paymentMethod:'mpesa',reference:'ABC123',notes:null,status:'pending',reviewNote:null,reviewedAt:null,createdAt:'2026-09-09T12:00:00Z',commercialPaymentId:null}]);
const review = vi.fn().mockResolvedValue({});
const submitExternal = vi.fn().mockResolvedValue({});
vi.mock('@/lib/externalInvoicePayments',()=>({
  externalInvoicePaymentMethodLabel:(value:string)=>value==='mpesa'?'M-Pesa':value,
  listRecipientExternalInvoicePayments:(...args:unknown[])=>listRecipient(...args),
  submitExternalInvoicePayment:(...args:unknown[])=>submitExternal(...args),
  listOwnerExternalInvoicePayments:(...args:unknown[])=>listOwner(...args),
  reviewExternalInvoicePayment:(...args:unknown[])=>review(...args),
}));

const document = {id:'invoice',role:'vendor',documentType:'invoice',documentNumber:'INV-1',title:'Photography',status:'sent',currency:'KES',recipientName:'Couple',recipientEmail:'couple@example.com',recipientPhone:null,weddingName:'Wedding',issueDate:'2026-09-09',dueDate:null,paidDate:null,notes:null,terms:null,subtotal:1000,discountAmount:0,taxAmount:0,totalAmount:1000,amountPaid:0,balanceDue:1000,issuerName:'Vendor',issuerEmail:null,issuerPhone:null,issuerWebsite:null,issuerLocation:null,paymentInstructions:null,authorisedBy:null,sourceInvoiceNumber:null,sourceInvoiceTitle:null,receiptPaymentMethod:null,receiptPaymentReference:null,receiptProcessingFee:0,receiptZaniaServiceFee:0,receiptTotalCharged:0,items:[],payments:[]} satisfies SharedCommercialDocument;
const wrapper = (ui:React.ReactNode) => <MemoryRouter initialEntries={['/documents/share/share']}><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><Routes><Route path="/documents/share/:token" element={ui}/><Route path="/received-documents" element={<p>Received documents</p>}/></Routes></QueryClientProvider></MemoryRouter>;

describe('external invoice payment flow',()=>{
  it('explains confirmation and opens an invoice-linked form',async()=>{
    render(wrapper(<ExternalPaymentReportDialog document={document} shareToken="share"/>));
    fireEvent.click(screen.getByRole('button',{name:'Record an external payment'}));
    expect(await screen.findByRole('heading',{name:'Record payment made outside Zania'})).toBeInTheDocument();
    expect(screen.getByText(/does not move money or charge a Zania fee/i)).toBeInTheDocument();
    expect(screen.getByText(/Outstanding: KES 1,000/)).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Submit for confirmation'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Submit for confirmation'}));
    expect(await screen.findByText('Received documents')).toBeInTheDocument();
    expect(submitExternal).toHaveBeenCalled();
  });
  it('requires professional confirmation before invoking the invoice update',async()=>{
    const onConfirmed=vi.fn().mockResolvedValue(undefined);
    render(wrapper(<ExternalPaymentReportsPanel documentId="invoice" currency="KES" onConfirmed={onConfirmed}/>));
    expect(await screen.findByText('External payment reports')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Confirm payment'}));
    await waitFor(()=>expect(review).toHaveBeenCalledWith('report','confirmed',null));
    expect(onConfirmed).toHaveBeenCalled();
  });
});
