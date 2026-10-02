import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import CommercialDocumentPaper from '@/components/documents/CommercialDocumentPaper';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCommercialDocument,
  listVendorListingOptions,
  type CommercialDocumentDetail,
  type VendorListingOption,
} from '@/lib/commercialDocuments';
import { commercialDocumentPrintTitle } from '@/lib/documentPrintTitle';
import { printDocumentElement } from '@/lib/printDocument';

function metadataText(document: CommercialDocumentDetail, key: string) {
  const value = document.metadata[key];
  return typeof value === 'string' ? value.trim() : '';
}

function metadataNumber(document: CommercialDocumentDetail, key: string) {
  const value = document.metadata[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
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
    void load();
    return () => { cancelled = true; };
  }, [documentId, toast]);

  useEffect(() => {
    if (!document) return;
    const previousTitle = window.document.title;
    window.document.title = commercialDocumentPrintTitle(document.documentNumber, document.title);
    return () => { window.document.title = previousTitle; };
  }, [document]);

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
  const printTitle = commercialDocumentPrintTitle(document.documentNumber, document.title);

  return (
    <main className="min-h-screen bg-[#f4f0ea] px-4 py-6 print:bg-white print:p-0 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="ghost" className="gap-2"><Link to={backPath}><ArrowLeft className="h-4 w-4" />Back to documents</Link></Button>
          <Button className="gap-2" onClick={() => printDocumentElement('commercial-document-print', printTitle)}><Printer className="h-4 w-4" />Print or save PDF</Button>
        </div>

        <div id="commercial-document-print">
        <CommercialDocumentPaper
          document={{
            ...document,
            issuerName,
            issuerEmail: issuerEmail ?? null,
            issuerPhone: issuerPhone ?? null,
            issuerWebsite: issuerWebsite ?? null,
            issuerLocation: issuerLocation || null,
            paymentInstructions: metadataText(document, 'paymentInstructions') || null,
            authorisedBy: metadataText(document, 'authorisedBy') || null,
            sourceInvoiceNumber: metadataText(document, 'source_invoice_number') || null,
            sourceInvoiceTitle: metadataText(document, 'source_invoice_title') || null,
            receiptPaymentMethod: metadataText(document, 'payment_method') || null,
            receiptPaymentReference: metadataText(document, 'payment_reference') || null,
            receiptProcessingFee: metadataNumber(document, 'payer_processing_fee'),
            receiptZaniaServiceFee: metadataNumber(document, 'zania_service_fee'),
            receiptTotalCharged: metadataNumber(document, 'total_charged'),
          }}
        />
        </div>
      </div>
    </main>
  );
}
