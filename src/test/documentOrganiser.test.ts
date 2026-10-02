import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { documentAlerts, dueInvoices, groupVendorDocuments, invoiceBalances, mergeDocumentActivity, type OrganisedDocument } from '@/lib/documentOrganiser';
const doc = (patch: Partial<OrganisedDocument> = {}): OrganisedDocument => ({ id:'invoice',document_type:'invoice',document_number:'INV-1',title:'Photography',status:'sent',currency:'KES',total_amount:1000,updated_at:'2026-09-09T12:00:00Z',share_token:'token',professional_id:'vendor-1',professional_name:'Vendor',professional_role:'vendor',source_id:null,due_date:'2026-10-01',amount_paid:500,balance_due:500,items:[],...patch });
describe('paid document organiser', () => {
  it('groups by professional identity, never name', () => {
    expect(groupVendorDocuments([doc(),doc({id:'other',professional_id:'vendor-2'})])).toHaveLength(2);
  });
  it('does not count quotes, receipts or void invoices as extra payments', () => {
    expect(invoiceBalances([doc(),doc({document_type:'receipt'}),doc({document_type:'quote'}),doc({status:'void'})])).toEqual([{currency:'KES',paid:500,due:500}]);
  });
  it('keeps currencies separate', () => {
    expect(invoiceBalances([doc(),doc({currency:'USD'})])).toHaveLength(2);
  });
  it('sorts outstanding invoices, puts missing dates last and excludes paid/void', () => {
    expect(dueInvoices([doc({id:'unknown',due_date:null}),doc(),doc({id:'void',status:'void'})]).map(d=>d.id)).toEqual(['invoice','unknown']);
  });
  it('only accepts matching non-void receipts as evidence', () => {
    expect(documentAlerts([doc(),doc({id:'receipt',document_type:'receipt',source_id:'invoice',total_amount:500})])).toHaveLength(0);
    expect(documentAlerts([doc(),doc({id:'receipt',document_type:'receipt',source_id:'invoice',total_amount:500,status:'void'})])).toHaveLength(1);
  });
  it('does not compare unrelated quotes to invoices', () => {
    expect(documentAlerts([doc({total_amount:5000,amount_paid:0}),doc({id:'quote',document_type:'quote',status:'accepted'})]).some(a=>a.message.includes('exceed'))).toBe(false);
  });
  it('checks totals only for explicitly linked accepted quotes', () => {
    expect(documentAlerts([doc({source_id:'quote',total_amount:1500,amount_paid:0}),doc({id:'quote',document_type:'quote',status:'accepted'})]).some(a=>a.message.includes('exceed'))).toBe(true);
  });
  it('adds actionable document activity using actual event timestamps', () => {
    const changes = mergeDocumentActivity([], [{id:'event',document_id:'invoice',document_type:'invoice',title:'Photography',document_number:'INV-1',status:'paid',previous_status:'sent',occurred_at:'2026-09-09T12:00:00Z',share_token:'token'}],5);
    expect(changes[0].title).toBe('Invoice paid');
    expect(changes[0].actionPath).toBe('/documents/share/token');
  });
});
