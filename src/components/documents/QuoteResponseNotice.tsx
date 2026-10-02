import { CheckCircle2, MessageSquareText } from 'lucide-react';
import {
  commercialDocumentLatestQuoteResponse,
  type CommercialDocumentRecord,
} from '@/lib/commercialDocuments';

export default function QuoteResponseNotice({ document }: { document: CommercialDocumentRecord }) {
  if (document.documentType !== 'quote') return null;
  const response = commercialDocumentLatestQuoteResponse(document);
  if (!response || document.status !== response.response) return null;

  if (response.response === 'accepted') {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950" aria-live="polite">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="font-semibold">Quote accepted by {response.responderName}</h3>
            <p className="mt-1 text-sm leading-6">The agreed quote is ready to convert into an invoice.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950" aria-live="polite">
      <div className="flex gap-3">
        <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold">{response.responderName} requested changes</h3>
          {response.message && <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{response.message}</p>}
          <p className="mt-3 text-sm font-medium">Edit the quote below, save it, then resend it for approval.</p>
        </div>
      </div>
    </section>
  );
}
