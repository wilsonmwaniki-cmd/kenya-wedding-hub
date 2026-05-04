import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Globe, Loader2, Mail, Phone, Printer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  commercialDocumentPaymentMethodLabel,
  commercialDocumentStatusLabel,
  commercialDocumentTypeLabel,
  getSharedCommercialDocument,
  type SharedCommercialDocument,
} from '@/lib/commercialDocuments';

function formatCurrency(amount: number) {
  return `KES ${amount.toLocaleString()}`;
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted-foreground shadow-card">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Opening shared document...
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
            This share link may have expired or been removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="ghost" className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Zania
            </Link>
          </Button>
          <Button className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print document
          </Button>
        </div>

        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(230,118,73,0.12),rgba(255,255,255,0.98)_38%,rgba(255,243,237,0.9))] shadow-card print:shadow-none">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                  Shared {commercialDocumentTypeLabel(document.documentType)}
                </p>
                <CardTitle className="mt-2 font-display text-3xl text-foreground">{document.title}</CardTitle>
                <CardDescription className="mt-2 text-sm text-muted-foreground">
                  {document.documentNumber} • {commercialDocumentStatusLabel(document.status)}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{commercialDocumentTypeLabel(document.documentType)}</Badge>
                <Badge variant={document.status === 'paid' || document.status === 'accepted' || document.status === 'issued' ? 'default' : 'outline'}>
                  {commercialDocumentStatusLabel(document.status)}
                </Badge>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Issued by</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{document.issuerName}</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {document.issuerEmail && (
                    <a className="flex items-center gap-2 hover:text-foreground" href={`mailto:${document.issuerEmail}`}>
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
                  {document.issuerWebsite && (
                    <a className="flex items-center gap-2 hover:text-foreground" href={document.issuerWebsite} target="_blank" rel="noreferrer">
                      <Globe className="h-4 w-4 text-primary" />
                      {document.issuerWebsite.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {document.issuerLocation && <p>{document.issuerLocation}</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm md:text-right">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recipient</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{document.recipientName}</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {document.recipientEmail && <p>{document.recipientEmail}</p>}
                  {document.recipientPhone && <p>{document.recipientPhone}</p>}
                  {document.weddingName && <p>{document.weddingName}</p>}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Issue date</CardDescription>
              <CardTitle className="text-xl">{safeDateLabel(document.issueDate)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Due date</CardDescription>
              <CardTitle className="text-xl">{safeDateLabel(document.dueDate)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(document.totalAmount)}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription>Balance due</CardDescription>
              <CardTitle className="text-xl">{formatCurrency(document.balanceDue)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Line items</CardTitle>
            <CardDescription>The commercial breakdown attached to this document.</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {(document.notes || document.terms) && (
          <div className="grid gap-4 md:grid-cols-2">
            {document.notes && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.notes}</p>
                </CardContent>
              </Card>
            )}
            {document.terms && (
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="font-display text-xl">Terms</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.terms}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Payment trail</CardTitle>
            <CardDescription>Recorded payments and receipt-ready references.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
