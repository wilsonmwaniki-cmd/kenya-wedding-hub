import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  commercialDocumentTypeLabel,
  getCommercialDocument,
  listVendorListingOptions,
  type CommercialDocumentDetail,
  type VendorListingOption,
} from '@/lib/commercialDocuments';

function money(amount: number) {
  return `KES ${amount.toLocaleString()}`;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB').format(new Date(`${value}T00:00:00`));
}

function metadataText(document: CommercialDocumentDetail, key: string) {
  const value = document.metadata[key];
  return typeof value === 'string' ? value.trim() : '';
}

export default function CommercialDocumentPrint() {
  const { documentId = '' } = useParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<CommercialDocumentDetail | null>(null);
  const [vendorListing, setVendorListing] = useState<VendorListingOption | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const detail = await getCommercialDocument(documentId);
        if (cancelled) return;
        setDocument(detail);
        if (detail?.vendorListingId) {
          const listings = await listVendorListingOptions();
          if (!cancelled) setVendorListing(listings.find((listing) => listing.id === detail.vendorListingId) ?? null);
        }
      } catch (error) {
        console.error('Could not load commercial document preview:', error);
        toast({ title: 'Could not open preview', description: 'We could not load this document right now.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [documentId, toast]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  const backPath = document?.role === 'planner' ? '/planner-documents' : '/vendor-documents';
  if (!document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md border border-border bg-card p-8 text-center">
          <h1 className="font-display text-2xl">Document not found</h1>
          <Button asChild className="mt-5"><Link to={backPath}>Back to documents</Link></Button>
        </div>
      </div>
    );
  }

  const issuerName = document.role === 'planner'
    ? profile?.company_name || profile?.full_name || 'Zania planner workspace'
    : vendorListing?.label || profile?.company_name || profile?.full_name || 'Zania vendor workspace';
  const issuerEmail = document.role === 'planner' ? profile?.company_email || user?.email : vendorListing?.email || profile?.company_email || user?.email;
  const issuerPhone = document.role === 'planner' ? profile?.company_phone : vendorListing?.phone || profile?.company_phone;
  const issuerWebsite = document.role === 'planner' ? profile?.company_website : vendorListing?.website || profile?.company_website;
  const issuerLocation = document.role === 'planner'
    ? [profile?.primary_town, profile?.primary_county].filter(Boolean).join(', ')
    : [vendorListing?.primaryTown, vendorListing?.primaryCounty].filter(Boolean).join(', ');
  const paymentInstructions = metadataText(document, 'paymentInstructions');
  const authorisedBy = metadataText(document, 'authorisedBy');
  const isReceipt = document.documentType === 'receipt';

  return (
    <main className="min-h-screen bg-[#eee9e1] px-4 py-6 text-foreground sm:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Button asChild variant="ghost" className="gap-2"><Link to={backPath}><ArrowLeft className="h-4 w-4" />Back to documents</Link></Button>
          <Button className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Print or save PDF</Button>
        </div>

        <article className="min-h-[1120px] overflow-hidden bg-[#fffdf9] shadow-[0_24px_70px_rgba(48,38,31,0.18)] print:min-h-0 print:shadow-none">
          <header className="bg-primary px-8 py-10 text-primary-foreground sm:px-12">
            <div className="grid gap-9 sm:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">{commercialDocumentTypeLabel(document.documentType)}</p>
                <h1 className="mt-3 font-display text-4xl font-semibold">{issuerName}</h1>
                <p className="mt-2 text-sm text-primary-foreground/75">{document.title}</p>
              </div>
              <div className="text-sm leading-6 text-primary-foreground/82 sm:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">Contact</p>
                {issuerLocation && <p>{issuerLocation}</p>}
                {issuerPhone && <p>{issuerPhone}</p>}
                {issuerEmail && <p>{issuerEmail}</p>}
                {issuerWebsite && <p>{issuerWebsite.replace(/^https?:\/\//, '')}</p>}
              </div>
            </div>
            <div className="mt-10 grid gap-7 border-t border-primary-foreground/20 pt-7 sm:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/68">{isReceipt ? 'Received from' : document.documentType === 'quote' ? 'Quote for' : 'Invoice to'}</p>
                <p className="mt-2 text-lg font-semibold">{document.recipientName}</p>
                {document.weddingName && <p className="text-sm text-primary-foreground/78">{document.weddingName}</p>}
                {document.recipientEmail && <p className="text-sm text-primary-foreground/78">{document.recipientEmail}</p>}
                {document.recipientPhone && <p className="text-sm text-primary-foreground/78">{document.recipientPhone}</p>}
              </div>
              <div className="grid grid-cols-2 gap-6 sm:text-right">
                <div><p className="text-[11px] uppercase tracking-[0.16em] text-primary-foreground/68">{isReceipt ? 'Payment date' : 'Issue date'}</p><p className="mt-2 font-semibold">{dateLabel(document.issueDate)}</p></div>
                {!isReceipt && <div><p className="text-[11px] uppercase tracking-[0.16em] text-primary-foreground/68">Due date</p><p className="mt-2 font-semibold">{dateLabel(document.dueDate)}</p></div>}
              </div>
            </div>
          </header>

          <div className="px-8 py-9 sm:px-12">
            <p className="mb-6 text-sm text-muted-foreground">Document number <strong className="text-foreground">{document.documentNumber}</strong></p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead><tr className="border-y border-border text-[11px] uppercase tracking-[0.14em] text-muted-foreground"><th className="w-14 py-4">No.</th><th className="py-4">Item description</th><th className="py-4 text-right">Price</th><th className="py-4 text-right">Qty.</th><th className="py-4 text-right">Total</th></tr></thead>
                <tbody>{document.items.map((item, index) => <tr key={item.id} className="border-b border-border/60"><td className="py-4 text-muted-foreground">{index + 1}.</td><td className="py-4 font-medium">{item.description}</td><td className="py-4 text-right">{money(item.unitPrice)}</td><td className="py-4 text-right">{item.quantity}</td><td className="py-4 text-right font-semibold">{money(item.lineTotal)}</td></tr>)}</tbody>
              </table>
            </div>

            <div className="mt-10 grid gap-10 md:grid-cols-[1fr_330px]">
              <div className="space-y-7">
                {paymentInstructions && <section><h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Payment method</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{paymentInstructions}</p></section>}
                {document.notes && <section><h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Note</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{document.notes}</p></section>}
                {document.terms && <section><h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Terms and conditions</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.terms}</p></section>}
              </div>
              <div>
                <div className="space-y-4 border-y border-border py-5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><strong>{money(document.subtotal)}</strong></div>
                  {!isReceipt && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{money(document.discountAmount)}</span></div>}
                  {!isReceipt && <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{money(document.taxAmount)}</span></div>}
                </div>
                <div className="mt-4 flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground"><span>{isReceipt ? 'Amount received' : 'Total'}</span><strong className="text-xl">{money(document.totalAmount)}</strong></div>
                {!isReceipt && document.amountPaid > 0 && <div className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>{money(document.amountPaid)}</span></div><div className="flex justify-between font-semibold"><span>Balance</span><span>{money(document.balanceDue)}</span></div></div>}
                {authorisedBy && <div className="mt-14 border-t border-border pt-3 text-sm"><p className="font-medium">{authorisedBy}</p><p className="text-muted-foreground">Authorised signatory</p></div>}
              </div>
            </div>
          </div>
          <footer className="mt-8 border-t border-primary/30 px-8 py-5 text-center text-xs text-muted-foreground sm:px-12">{isReceipt ? 'Payment received with thanks.' : 'Thank you for your business.'}</footer>
        </article>
      </div>
    </main>
  );
}
