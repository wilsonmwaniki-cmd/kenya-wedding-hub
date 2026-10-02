import BrandWordmark from '@/components/BrandWordmark';
import {
  commercialDocumentPaymentMethodLabel,
  commercialDocumentStatusLabel,
  commercialDocumentTypeLabel,
  type CommercialDocumentPaymentMethod,
  type CommercialDocumentStatus,
  type CommercialDocumentType,
} from '@/lib/commercialDocuments';
import { displaySafeUrl, normalizeEmailHref, normalizeExternalUrl } from '@/lib/security';
import { commercialDocumentDateFields, formatCommercialDocumentDate } from '@/lib/commercialDocumentPresentation';

export type CommercialDocumentPaperData = {
  documentType: CommercialDocumentType;
  documentNumber: string;
  title: string;
  status: CommercialDocumentStatus;
  currency: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  weddingName: string | null;
  issueDate: string;
  dueDate: string | null;
  paidDate: string | null;
  notes: string | null;
  terms: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  issuerName: string;
  issuerEmail: string | null;
  issuerPhone: string | null;
  issuerWebsite: string | null;
  issuerLocation: string | null;
  paymentInstructions?: string | null;
  authorisedBy?: string | null;
  sourceInvoiceNumber?: string | null;
  sourceInvoiceTitle?: string | null;
  receiptPaymentMethod?: string | null;
  receiptPaymentReference?: string | null;
  receiptProcessingFee?: number;
  receiptZaniaServiceFee?: number;
  receiptTotalCharged?: number;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: CommercialDocumentPaymentMethod;
    reference: string | null;
  }>;
};

function formatCurrency(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

type Props = {
  document: CommercialDocumentPaperData;
};

export default function CommercialDocumentPaper({ document }: Props) {
  const typeLabel = commercialDocumentTypeLabel(document.documentType);
  const currency = document.currency || 'KES';
  const dateFields = commercialDocumentDateFields(document);
  const issuerEmailHref = normalizeEmailHref(document.issuerEmail);
  const issuerWebsiteHref = normalizeExternalUrl(document.issuerWebsite);
  const hasPricing = document.items.length > 0 || document.totalAmount > 0;
  const hasPaymentDetails = document.documentType !== 'receipt' && (document.payments.length > 0 || document.amountPaid > 0);
  const recipientLabel = document.documentType === 'receipt' ? 'Received from' : 'Prepared for';

  return (
    <article className="border border-[#ded8d3] bg-[#fffdf9] text-foreground print:border-0">
      <div className="p-6 sm:p-10 print:p-8">
        <BrandWordmark size="sm" className="mb-9" />

        <header className="flex flex-col gap-7 border-b border-[#ded8d3] pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{typeLabel}</p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">{document.title}</h1>
            <p className="mt-3 text-sm text-muted-foreground">{document.documentNumber}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {document.documentType === 'receipt' ? 'Amount received' : 'Total'}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold">{formatCurrency(document.totalAmount, currency)}</p>
          </div>
        </header>

        <div className="grid gap-8 border-b border-[#ded8d3] py-8 sm:grid-cols-2">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Prepared by</p>
            <p className="mt-3 text-lg font-semibold">{document.issuerName}</p>
            <div className="mt-3 space-y-1.5 text-sm leading-6 text-muted-foreground">
              {document.issuerEmail && issuerEmailHref && <p><a className="hover:text-foreground hover:underline" href={issuerEmailHref}>{document.issuerEmail}</a></p>}
              {document.issuerPhone && <p>{document.issuerPhone}</p>}
              {document.issuerWebsite && issuerWebsiteHref && (
                <p><a className="hover:text-foreground hover:underline" href={issuerWebsiteHref} target="_blank" rel="noopener noreferrer">{displaySafeUrl(document.issuerWebsite)}</a></p>
              )}
              {document.issuerLocation && <p>{document.issuerLocation}</p>}
            </div>
          </section>

          <section className="sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{recipientLabel}</p>
            <p className="mt-3 text-lg font-semibold">{document.recipientName}</p>
            <div className="mt-3 space-y-1.5 text-sm leading-6 text-muted-foreground">
              {document.recipientEmail && <p>{document.recipientEmail}</p>}
              {document.recipientPhone && <p>{document.recipientPhone}</p>}
              {document.weddingName && document.weddingName !== document.recipientName && <p>{document.weddingName}</p>}
            </div>
          </section>
        </div>

        <dl className="grid border-b border-[#ded8d3] sm:grid-cols-3">
          {dateFields.map((field, index) => (
            <div key={field.label} className={`py-5 ${index > 0 ? 'border-t border-[#ded8d3] sm:border-l sm:border-t-0 sm:px-6' : 'sm:pr-6'}`}>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{field.label}</dt>
              <dd className="mt-2 font-semibold">{field.value}</dd>
            </div>
          ))}
          <div className="border-t border-[#ded8d3] py-5 sm:border-l sm:border-t-0 sm:pl-6">
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Status</dt>
            <dd className="mt-2 font-semibold">{commercialDocumentStatusLabel(document.status)}</dd>
          </div>
        </dl>

        {document.documentType === 'receipt' && (document.sourceInvoiceNumber || document.receiptPaymentMethod || document.receiptPaymentReference) && (
          <section className="border-b border-[#ded8d3] py-6">
            <h2 className="font-semibold">Payment details</h2>
            <dl className="mt-4 grid gap-5 text-sm sm:grid-cols-3">
              {document.sourceInvoiceNumber && (
                <div><dt className="text-muted-foreground">Invoice</dt><dd className="mt-1 font-medium">{document.sourceInvoiceNumber}</dd></div>
              )}
              {document.receiptPaymentMethod && (
                <div><dt className="text-muted-foreground">Method</dt><dd className="mt-1 font-medium">{commercialDocumentPaymentMethodLabel(document.receiptPaymentMethod)}</dd></div>
              )}
              {document.receiptPaymentReference && (
                <div><dt className="text-muted-foreground">Reference</dt><dd className="mt-1 break-words font-medium">{document.receiptPaymentReference}</dd></div>
              )}
            </dl>
          </section>
        )}

        {document.documentType === 'receipt' && Number(document.receiptTotalCharged ?? 0) > 0 && (
          <section className="border-b border-[#ded8d3] py-6">
            <h2 className="font-semibold">Checkout charges</h2>
            <p className="mt-1 text-sm text-muted-foreground">The amount received by the professional remains {formatCurrency(document.totalAmount, currency)}.</p>
            <dl className="mt-4 max-w-md space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Invoice payment</dt><dd className="font-medium">{formatCurrency(document.totalAmount, currency)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Provider processing fee</dt><dd className="font-medium">{formatCurrency(document.receiptProcessingFee ?? 0, currency)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Zania service fee</dt><dd className="font-medium">{formatCurrency(document.receiptZaniaServiceFee ?? 0, currency)}</dd></div>
              <div className="flex justify-between gap-4 border-t border-[#ded8d3] pt-2"><dt className="font-semibold">Total charged</dt><dd className="font-semibold">{formatCurrency(document.receiptTotalCharged ?? 0, currency)}</dd></div>
            </dl>
          </section>
        )}

        <section className="pt-8">
          <h2 className="text-xl font-semibold">{typeLabel} details</h2>
          {document.items.length ? (
            <>
              <div className="mt-5 divide-y divide-[#ded8d3] border-y border-[#ded8d3] sm:hidden">
                {document.items.map((item) => (
                  <div key={item.id} className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium">{item.description}</p>
                      <p className="shrink-0 font-semibold">{formatCurrency(item.lineTotal, currency)}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.quantity} × {formatCurrency(item.unitPrice, currency)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 hidden overflow-x-auto border-y border-[#ded8d3] sm:block">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
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
                        <td className="px-3 py-4">{item.description}</td>
                        <td className="px-3 py-4 text-muted-foreground">{item.quantity}</td>
                        <td className="px-3 py-4 text-muted-foreground">{formatCurrency(item.unitPrice, currency)}</td>
                        <td className="px-3 py-4 text-right font-semibold">{formatCurrency(item.lineTotal, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-4 border-y border-[#ded8d3] py-6 text-sm text-muted-foreground">No items added.</p>
          )}

          {hasPricing && (
            <dl className="ml-auto mt-6 max-w-sm space-y-3 text-sm">
              <div className="flex items-center justify-between gap-6"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-medium">{formatCurrency(document.subtotal, currency)}</dd></div>
              {document.discountAmount > 0 && <div className="flex items-center justify-between gap-6"><dt className="text-muted-foreground">Discount</dt><dd className="font-medium">− {formatCurrency(document.discountAmount, currency)}</dd></div>}
              {document.taxAmount > 0 && <div className="flex items-center justify-between gap-6"><dt className="text-muted-foreground">Tax</dt><dd className="font-medium">{formatCurrency(document.taxAmount, currency)}</dd></div>}
              <div className="flex items-center justify-between gap-6 border-t border-[#ded8d3] pt-3 text-base"><dt className="font-semibold">Total</dt><dd className="font-semibold">{formatCurrency(document.totalAmount, currency)}</dd></div>
            </dl>
          )}
        </section>

        {document.paymentInstructions && <section className="mt-10 border-t border-[#ded8d3] pt-8"><h2 className="font-semibold">Payment details</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.paymentInstructions}</p></section>}
        {document.notes && <section className="mt-10 border-t border-[#ded8d3] pt-8"><h2 className="font-semibold">Notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.notes}</p></section>}
        {document.terms && <section className="mt-10 border-t border-[#ded8d3] pt-8"><h2 className="font-semibold">Terms</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{document.terms}</p></section>}

        {document.authorisedBy && <section className="mt-12 max-w-xs border-t border-[#8a7d73] pt-3 text-sm"><p className="font-medium">{document.authorisedBy}</p><p className="text-muted-foreground">Authorised signatory</p></section>}

        {hasPaymentDetails && (
          <section className="mt-10 border-t border-[#ded8d3] pt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-xl font-semibold">Payments</h2><p className="mt-1 text-sm text-muted-foreground">Paid {formatCurrency(document.amountPaid, currency)}</p></div>
              <p className="text-sm font-semibold">Balance {formatCurrency(document.balanceDue, currency)}</p>
            </div>
            {document.payments.length > 0 && (
              <div className="mt-5 overflow-x-auto border-y border-[#ded8d3]">
                <table className="w-full min-w-[580px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground"><tr><th className="px-3 py-4 font-medium">Date</th><th className="px-3 py-4 font-medium">Method</th><th className="px-3 py-4 font-medium">Reference</th><th className="px-3 py-4 text-right font-medium">Amount</th></tr></thead>
                  <tbody>{document.payments.map((payment) => <tr key={payment.id} className="border-t border-[#ded8d3]"><td className="px-3 py-4">{formatCommercialDocumentDate(payment.paymentDate)}</td><td className="px-3 py-4">{commercialDocumentPaymentMethodLabel(payment.paymentMethod)}</td><td className="px-3 py-4">{payment.reference || '—'}</td><td className="px-3 py-4 text-right font-semibold">{formatCurrency(payment.amount, currency)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      <footer className="border-t border-[#ded8d3] px-6 py-5 text-xs uppercase tracking-[0.16em] text-muted-foreground sm:px-10">Created with Zania</footer>
    </article>
  );
}
