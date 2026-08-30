import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Globe, Mail, Phone, Printer } from 'lucide-react';
import BrandWordmark from '@/components/BrandWordmark';
import { PublicLinkLoading, PublicLinkUnavailable } from '@/components/PublicLinkState';
import { Button } from '@/components/ui/button';
import {
  commercialDocumentPaymentMethodLabel,
  commercialDocumentStatusLabel,
  commercialDocumentTypeLabel,
  getSharedCommercialDocument,
  type SharedCommercialDocument,
} from '@/lib/commercialDocuments';
import { displaySafeUrl, normalizeEmailHref, normalizeExternalUrl } from '@/lib/security';

function formatCurrency(amount: number, currency = 'KES') {
  return `${currency} ${amount.toLocaleString('en-KE')}`;
}

function safeDateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CommercialDocumentShare() {
  const { token = '' } = useParams();
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<SharedCommercialDocument | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, [token]);

  const paymentTotal = useMemo(
    () => document?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0,
    [document],
  );
  const issuerEmailHref = normalizeEmailHref(document?.issuerEmail);
  const issuerWebsiteHref = normalizeExternalUrl(document?.issuerWebsite);

  if (loading) {
    return <PublicLinkLoading loadingLabel="Opening document…" />;
  }

  if (!document) {
    return <PublicLinkUnavailable title="Document unavailable" message="Ask the sender for a new link." />;
  }

  const currency = document.currency || 'KES';
  const hasPricing = document.items.length > 0 || document.totalAmount > 0;
  const hasPaymentDetails = document.payments.length > 0 || document.amountPaid > 0;

  return (
    <div className="min-h-screen bg-[#f7f3ef] px-4 py-6 sm:px-6 sm:py-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <BrandWordmark size="sm" />
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" className="gap-2">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
                Back to wedding home
              </Link>
            </Button>
            <Button className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </header>

        <main className="border border-[#ded8d3] bg-white print:border-0">
          <section className="p-6 sm:p-10">
            <div className="flex flex-col gap-8 border-b border-[#ded8d3] pb-8 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <BrandWordmark size="sm" className="mb-8 hidden print:inline-flex" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Zania {commercialDocumentTypeLabel(document.documentType)}
                </p>
                <h1 className="mt-3 text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
                  {document.title}
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                  {document.documentNumber} · {commercialDocumentStatusLabel(document.status)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total</p>
                <p className="mt-2 text-3xl font-semibold text-foreground">
                  {formatCurrency(document.totalAmount, currency)}
                </p>
              </div>
            </div>

            <div className="grid gap-8 border-b border-[#ded8d3] py-8 sm:grid-cols-2">
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Prepared by</p>
                <p className="mt-3 text-lg font-semibold text-foreground">{document.issuerName}</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {document.issuerEmail && issuerEmailHref && (
                    <a className="flex items-center gap-2 hover:text-foreground" href={issuerEmailHref}>
                      <Mail className="h-4 w-4 text-primary" />
                      {document.issuerEmail}
                    </a>
                  )}
                  {document.issuerPhone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      {document.issuerPhone}
                    </p>
                  )}
                  {document.issuerWebsite && issuerWebsiteHref && (
                    <a className="flex items-center gap-2 hover:text-foreground" href={issuerWebsiteHref} target="_blank" rel="noopener noreferrer">
                      <Globe className="h-4 w-4 text-primary" />
                      {displaySafeUrl(document.issuerWebsite)}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {document.issuerLocation && <p>{document.issuerLocation}</p>}
                </div>
              </section>

              <section className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Prepared for</p>
                <p className="mt-3 text-lg font-semibold text-foreground">{document.recipientName}</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {document.recipientEmail && <p>{document.recipientEmail}</p>}
                  {document.recipientPhone && <p>{document.recipientPhone}</p>}
                  {document.weddingName && document.weddingName !== document.recipientName && <p>{document.weddingName}</p>}
                </div>
              </section>
            </div>

            <dl className="grid border-b border-[#ded8d3] sm:grid-cols-3">
              <div className="py-5 sm:border-r sm:border-[#ded8d3] sm:pr-6">
                <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Issue date</dt>
                <dd className="mt-2 font-semibold text-foreground">{safeDateLabel(document.issueDate)}</dd>
              </div>
              <div className="border-t border-[#ded8d3] py-5 sm:border-r sm:border-t-0 sm:border-[#ded8d3] sm:px-6">
                <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Valid until</dt>
                <dd className="mt-2 font-semibold text-foreground">{safeDateLabel(document.dueDate)}</dd>
              </div>
              <div className="border-t border-[#ded8d3] py-5 sm:border-t-0 sm:pl-6">
                <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Status</dt>
                <dd className="mt-2 font-semibold text-foreground">{commercialDocumentStatusLabel(document.status)}</dd>
              </div>
            </dl>

            <section className="pt-8">
              <h2 className="text-xl font-semibold text-foreground">Quote details</h2>
              {document.items.length ? (
                <div className="mt-5 overflow-x-auto border-y border-[#ded8d3]">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-4 font-medium">Description</th>
                        <th className="px-3 py-4 font-medium">Qty</th>
                        <th className="px-3 py-4 font-medium">Unit price</th>
                        <th className="px-3 py-4 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.items.map((item) => (
                        <tr key={item.id} className="border-t border-[#ded8d3]">
                          <td className="px-3 py-4 text-foreground">{item.description}</td>
                          <td className="px-3 py-4 text-muted-foreground">{item.quantity}</td>
                          <td className="px-3 py-4 text-muted-foreground">{formatCurrency(item.unitPrice, currency)}</td>
                          <td className="px-3 py-4 text-right font-semibold text-foreground">{formatCurrency(item.lineTotal, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-4 border-y border-[#ded8d3] py-6 text-sm text-muted-foreground">
                  No pricing has been added to this draft yet.
                </p>
              )}

              {hasPricing && (
                <dl className="ml-auto mt-6 max-w-sm space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-6">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd className="font-medium text-foreground">{formatCurrency(document.subtotal, currency)}</dd>
                  </div>
                  {document.discountAmount > 0 && (
                    <div className="flex items-center justify-between gap-6">
                      <dt className="text-muted-foreground">Discount</dt>
                      <dd className="font-medium text-foreground">− {formatCurrency(document.discountAmount, currency)}</dd>
                    </div>
                  )}
                  {document.taxAmount > 0 && (
                    <div className="flex items-center justify-between gap-6">
                      <dt className="text-muted-foreground">Tax</dt>
                      <dd className="font-medium text-foreground">{formatCurrency(document.taxAmount, currency)}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-6 border-t border-[#ded8d3] pt-3 text-base">
                    <dt className="font-semibold text-foreground">Total</dt>
                    <dd className="font-semibold text-foreground">{formatCurrency(document.totalAmount, currency)}</dd>
                  </div>
                </dl>
              )}
            </section>

            {(document.notes || document.terms) && (
              <div className="mt-10 grid gap-8 border-t border-[#ded8d3] pt-8 sm:grid-cols-2">
                {document.notes && (
                  <section>
                    <h2 className="font-semibold text-foreground">Notes</h2>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.notes}</p>
                  </section>
                )}
                {document.terms && (
                  <section>
                    <h2 className="font-semibold text-foreground">Terms</h2>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.terms}</p>
                  </section>
                )}
              </div>
            )}

            {hasPaymentDetails && (
              <section className="mt-10 border-t border-[#ded8d3] pt-8">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Payments</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Paid {formatCurrency(paymentTotal, currency)}</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">Balance {formatCurrency(document.balanceDue, currency)}</p>
                </div>
                {document.payments.length > 0 && (
                  <div className="mt-5 overflow-x-auto border-y border-[#ded8d3]">
                    <table className="w-full min-w-[580px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                          <th className="px-3 py-4 font-medium">Date</th>
                          <th className="px-3 py-4 font-medium">Method</th>
                          <th className="px-3 py-4 font-medium">Reference</th>
                          <th className="px-3 py-4 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {document.payments.map((payment) => (
                          <tr key={payment.id} className="border-t border-[#ded8d3]">
                            <td className="px-3 py-4">{safeDateLabel(payment.paymentDate)}</td>
                            <td className="px-3 py-4">{commercialDocumentPaymentMethodLabel(payment.paymentMethod)}</td>
                            <td className="px-3 py-4">{payment.reference || '—'}</td>
                            <td className="px-3 py-4 text-right font-semibold">{formatCurrency(payment.amount, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </section>

          <footer className="border-t border-[#ded8d3] px-6 py-5 text-xs uppercase tracking-[0.16em] text-muted-foreground sm:px-10">
            Created with Zania
          </footer>
        </main>
      </div>
    </div>
  );
}
