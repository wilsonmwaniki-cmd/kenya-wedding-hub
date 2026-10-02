import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import DocumentBackLink from '@/components/documents/DocumentBackLink';
import CommercialDocumentPaper from '@/components/documents/CommercialDocumentPaper';
import InvoicePaymentPanel from '@/components/documents/InvoicePaymentPanel';
import QuoteResponsePanel from '@/components/documents/QuoteResponsePanel';
import { PublicLinkLoading, PublicLinkUnavailable } from '@/components/PublicLinkState';
import { Button } from '@/components/ui/button';
import { getSharedCommercialDocument, type SharedCommercialDocument } from '@/lib/commercialDocuments';
import { commercialDocumentPrintTitle } from '@/lib/documentPrintTitle';
import { printDocumentElement } from '@/lib/printDocument';

export default function CommercialDocumentShare() {
  const { token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<SharedCommercialDocument | null>(null);

  const loadDocument = useCallback(async () => {
    const data = await getSharedCommercialDocument(token);
    setDocument(data);
  }, [token]);

  useEffect(() => {
    if (!document) return;
    const previousTitle = window.document.title;
    window.document.title = commercialDocumentPrintTitle(document.documentNumber, document.title);
    return () => { window.document.title = previousTitle; };
  }, [document]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getSharedCommercialDocument(token);
        if (!cancelled) setDocument(data);
      } catch (error) {
        console.error('Could not load shared commercial document:', error);
        if (!cancelled) setDocument(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [token]);

  if (loading) {
    return <PublicLinkLoading loadingLabel="Opening document…" />;
  }

  if (!document) {
    return <PublicLinkUnavailable title="Document unavailable" message="Ask the sender for a new link." />;
  }
  const printTitle = commercialDocumentPrintTitle(document.documentNumber, document.title);

  return (
    <main className="min-h-screen bg-[#f4f0ea] px-4 py-6 print:bg-white print:p-0 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <DocumentBackLink />
          <Button className="gap-2" onClick={() => printDocumentElement('commercial-document-print', printTitle)}><Printer className="h-4 w-4" />Print or save PDF</Button>
        </div>

        <div id="commercial-document-print"><CommercialDocumentPaper document={document} /></div>
        <QuoteResponsePanel token={token} document={document} onDocumentChanged={loadDocument} />
        <InvoicePaymentPanel document={document} shareToken={token} onDocumentChanged={loadDocument} />
      </div>
    </main>
  );
}
