import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  commercialDocumentPaymentMethodLabel,
  commercialDocumentStatusLabel,
  commercialDocumentTypeLabel,
  getCommercialDocument,
  listVendorListingOptions,
  type CommercialDocumentDetail,
} from '@/lib/commercialDocuments';

function formatCurrency(amount: number) {
  return `KES ${amount.toLocaleString()}`;
}

function safeDateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function CommercialDocumentPrint() {
  const { documentId = '' } = useParams();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [document, setDocument] = useState<CommercialDocumentDetail | null>(null);
  const [vendorListingLabel, setVendorListingLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const detail = await getCommercialDocument(documentId);
        if (cancelled) return;
        setDocument(detail);

        if (detail?.vendorListingId) {
          const listings = await listVendorListingOptions();
          if (cancelled) return;
          setVendorListingLabel(listings.find((listing) => listing.id === detail.vendorListingId)?.label ?? null);
        } else {
          setVendorListingLabel(null);
        }
      } catch (error) {
        console.error('Could not load printable commercial document:', error);
        toast({
          title: 'Could not open print view',
          description: 'We could not load this document right now.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const paymentTotal = useMemo(
    () => document?.payments.reduce((sum, payment) => sum + payment.amount, 0) ?? 0,
    [document],
  );
  const backPath = document?.role === 'planner' ? '/planner-documents' : '/vendor-documents';
  const issuedByLabel =
    document?.role === 'planner'
      ? profile?.full_name || 'Zania planner workspace'
      : vendorListingLabel || profile?.full_name || 'Zania vendor workspace';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Preparing printable document...
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-card">
          <p className="font-display text-2xl text-foreground">Document not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This document could not be loaded or may no longer exist.
          </p>
          <Button asChild className="mt-4 gap-2">
            <Link to={backPath}>
              <ArrowLeft className="h-4 w-4" />
              Back to documents
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="ghost" className="gap-2">
            <Link to={backPath}>
              <ArrowLeft className="h-4 w-4" />
              Back to documents
            </Link>
          </Button>
          <Button className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print document
          </Button>
        </div>

        <Card className="overflow-hidden border-border shadow-card print:shadow-none">
          <CardHeader className="border-b border-border bg-muted/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                  {commercialDocumentTypeLabel(document.documentType)}
                </p>
                <CardTitle className="mt-2 font-display text-3xl text-foreground">{document.title}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  {document.documentNumber} • {commercialDocumentStatusLabel(document.status)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{commercialDocumentTypeLabel(document.documentType)}</Badge>
                <Badge variant={document.status === 'paid' || document.status === 'accepted' || document.status === 'issued' ? 'default' : 'outline'}>
                  {commercialDocumentStatusLabel(document.status)}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Issued by</p>
                <p className="font-semibold text-foreground">{issuedByLabel}</p>
                <p className="text-sm text-muted-foreground">{user?.email || document.recipientEmail || '—'}</p>
              </div>
              <div className="space-y-2 md:text-right">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recipient</p>
                <p className="font-semibold text-foreground">{document.recipientName}</p>
                {document.recipientEmail && <p className="text-sm text-muted-foreground">{document.recipientEmail}</p>}
                {document.recipientPhone && <p className="text-sm text-muted-foreground">{document.recipientPhone}</p>}
                {document.weddingName && <p className="text-sm text-muted-foreground">{document.weddingName}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Issue date</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{safeDateLabel(document.issueDate)}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Due date</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{safeDateLabel(document.dueDate)}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Total</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(document.totalAmount)}</p>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Balance due</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(document.balanceDue)}</p>
              </div>
            </div>

            <section className="space-y-4">
              <div>
                <h2 className="font-display text-2xl text-foreground">Line items</h2>
                <p className="text-sm text-muted-foreground">The service breakdown attached to this document.</p>
              </div>

              {document.items.length ? (
                <div className="overflow-hidden rounded-2xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/20 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Unit price</th>
                        <th className="px-4 py-3 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.items.map((item) => (
                        <tr key={item.id} className="border-t border-border/60">
                          <td className="px-4 py-3">{item.description}</td>
                          <td className="px-4 py-3">{item.quantity}</td>
                          <td className="px-4 py-3">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                  No line items were attached to this document yet.
                </div>
              )}
            </section>

            {(document.notes || document.terms) && (
              <section className="grid gap-4 md:grid-cols-2">
                {document.notes && (
                  <div className="rounded-2xl border border-border p-4">
                    <h3 className="font-display text-xl text-foreground">Notes</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.notes}</p>
                  </div>
                )}
                {document.terms && (
                  <div className="rounded-2xl border border-border p-4">
                    <h3 className="font-display text-xl text-foreground">Terms</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.terms}</p>
                  </div>
                )}
              </section>
            )}

            <section className="space-y-4">
              <div>
                <h2 className="font-display text-2xl text-foreground">Payment trail</h2>
                <p className="text-sm text-muted-foreground">Recorded payments and receipt-ready references.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Collected</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{formatCurrency(paymentTotal)}</p>
                </div>
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Amount paid</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{formatCurrency(document.amountPaid)}</p>
                </div>
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Remaining</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{formatCurrency(document.balanceDue)}</p>
                </div>
              </div>

              {document.payments.length ? (
                <div className="overflow-hidden rounded-2xl border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/20 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Reference</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.payments.map((payment) => (
                        <tr key={payment.id} className="border-t border-border/60">
                          <td className="px-4 py-3">{safeDateLabel(payment.paymentDate)}</td>
                          <td className="px-4 py-3">{commercialDocumentPaymentMethodLabel(payment.paymentMethod)}</td>
                          <td className="px-4 py-3">{payment.reference || '—'}</td>
                          <td className="px-4 py-3 text-right font-medium text-foreground">{formatCurrency(payment.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
                  No payments have been recorded against this document yet.
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
