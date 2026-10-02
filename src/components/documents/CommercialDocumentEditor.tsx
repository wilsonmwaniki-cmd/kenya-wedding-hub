import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { Check, CloudOff, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CurrencyInput from '@/components/documents/CurrencyInput';
import QuantityInput from '@/components/documents/QuantityInput';
import AdditionalRecipientEmailsInput from '@/components/documents/AdditionalRecipientEmailsInput';
import ContactRecipientPicker from '@/components/documents/ContactRecipientPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  commercialDocumentStatusLabel,
  commercialDocumentStatusOptionsFor,
  commercialDocumentPaymentMethodLabel,
  commercialDocumentTypeLabel,
  type CommercialDocumentDetail,
  type CommercialDocumentStatus,
  type SaveCommercialDocumentItemInput,
} from '@/lib/commercialDocuments';
import { listZaniaPayAccounts, setCommercialDocumentPayoutAccount, type ZaniaPayAccountStatus } from '@/lib/zaniaPay';
import { useToast } from '@/hooks/use-toast';
import type { DocumentAutosaveStatus } from '@/hooks/useDocumentAutosave';

export type CommercialDocumentHeaderDraft = {
  title: string;
  status: CommercialDocumentStatus;
  recipientName: string;
  recipientEmail: string;
  additionalRecipientEmails: string[];
  recipientPhone: string;
  weddingName: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  terms: string;
  discountAmount: number;
  taxAmount: number;
  paymentInstructions: string;
  authorisedBy: string;
};

type Props = {
  idPrefix: string;
  document: CommercialDocumentDetail;
  draft: CommercialDocumentHeaderDraft;
  setDraft: Dispatch<SetStateAction<CommercialDocumentHeaderDraft | null>>;
  items: SaveCommercialDocumentItemInput[];
  setItems: Dispatch<SetStateAction<SaveCommercialDocumentItemInput[]>>;
  saving: boolean;
  onSave: () => void | Promise<void>;
  autosaveStatus?: DocumentAutosaveStatus;
  onRetryAutosave?: () => void;
  onFlushAutosave?: () => void;
};

function money(amount: number) {
  return `KES ${amount.toLocaleString()}`;
}

export default function CommercialDocumentEditor({
  idPrefix,
  document,
  draft,
  setDraft,
  items,
  setItems,
  saving,
  onSave,
  autosaveStatus = 'idle',
  onRetryAutosave,
  onFlushAutosave,
}: Props) {
  const { toast } = useToast();
  const isReceipt = document.documentType === 'receipt';
  const [payoutAccounts, setPayoutAccounts] = useState<ZaniaPayAccountStatus[]>([]);
  const [payoutAccountId, setPayoutAccountId] = useState(document.payoutAccountId ?? 'default');
  const [savingPayout, setSavingPayout] = useState(false);

  useEffect(() => {
    setPayoutAccountId(document.payoutAccountId ?? 'default');
    if (document.documentType !== 'invoice') return;
    let cancelled = false;
    listZaniaPayAccounts()
      .then((accounts) => { if (!cancelled) setPayoutAccounts(accounts.filter((account) => account.status === 'verified')); })
      .catch((error) => console.error('Could not load invoice payout accounts:', error));
    return () => { cancelled = true; };
  }, [document.id, document.documentType, document.payoutAccountId]);

  const choosePayoutAccount = async (value: string) => {
    const previous = payoutAccountId;
    setPayoutAccountId(value);
    setSavingPayout(true);
    try {
      await setCommercialDocumentPayoutAccount(document.id, value === 'default' ? null : value);
      toast({ title: 'Invoice payout destination updated', description: value === 'default' ? 'This invoice will use your default payout account.' : 'Payments for this invoice will use the selected account.' });
    } catch (error) {
      setPayoutAccountId(previous);
      toast({ title: 'Could not change the payout destination', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setSavingPayout(false); }
  };
  const calculatedSubtotal = items.reduce(
    (sum, item) => sum + Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0),
    0,
  );
  const subtotal = isReceipt ? Number(document.subtotal || document.totalAmount || 0) : calculatedSubtotal;
  const total = isReceipt
    ? Number(document.totalAmount || subtotal)
    : Math.max(0, subtotal - Number(draft.discountAmount || 0) + Number(draft.taxAmount || 0));
  const hasLineItems = items.some((item) => item.description.trim());
  const updateDraft = (patch: Partial<CommercialDocumentHeaderDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };
  const receiptInvoiceNumber = typeof document.metadata.source_invoice_number === 'string'
    ? document.metadata.source_invoice_number
    : null;
  const receiptPaymentMethod = typeof document.metadata.payment_method === 'string'
    ? commercialDocumentPaymentMethodLabel(document.metadata.payment_method)
    : null;
  const receiptPaymentReference = typeof document.metadata.payment_reference === 'string'
    ? document.metadata.payment_reference
    : null;

  return (
    <section
      className="overflow-hidden border border-border/80 bg-[#fffdf9] shadow-[0_18px_44px_rgba(55,42,34,0.08)]"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onFlushAutosave?.();
      }}
    >
      <div className="bg-primary px-6 py-7 text-primary-foreground md:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/72">
            {commercialDocumentTypeLabel(document.documentType)} {document.documentNumber}
          </p>
          <Label htmlFor={`${idPrefix}-title`} className="sr-only">Document title</Label>
          <Input
            id={`${idPrefix}-title`}
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            className="mt-3 h-auto border-0 bg-transparent px-0 font-display text-3xl font-semibold text-primary-foreground shadow-none focus-visible:ring-primary-foreground/35"
            aria-label="Document title"
          />
          {!draft.title.trim() && (
            <p className="mt-2 text-xs text-primary-foreground/80">Add a clear title before sharing this document.</p>
          )}
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6 md:space-y-8 md:p-8">
        <div className="grid gap-4 border-b border-border/70 pb-6 md:grid-cols-[1.2fr_0.8fr] md:gap-6 md:pb-8">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{isReceipt ? 'Received from' : 'Bill to'}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`${idPrefix}-recipient`}>Client or couple <span className="text-destructive">*</span></Label>
                <ContactRecipientPicker
                  id={`${idPrefix}-recipient`}
                  value={draft.recipientName}
                  onChange={(recipientName) => updateDraft({ recipientName })}
                  onSelect={(contact) => updateDraft({
                    recipientName: contact.displayName,
                    recipientEmail: contact.primaryEmail ?? draft.recipientEmail,
                    recipientPhone: contact.phone ?? draft.recipientPhone,
                    additionalRecipientEmails: contact.additionalEmails,
                  })}
                />
                {!draft.recipientName.trim() && <p className="text-xs text-destructive">Add the person receiving this document.</p>}
              </div>
              <details className="sm:col-span-2 rounded-2xl border border-border/70">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none">Contact details</summary>
                <div className="grid gap-4 border-t border-border/70 p-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-email`}>Email</Label>
                    <Input id={`${idPrefix}-email`} type="email" value={draft.recipientEmail} onChange={(event) => updateDraft({ recipientEmail: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
                    <Input id={`${idPrefix}-phone`} value={draft.recipientPhone} onChange={(event) => updateDraft({ recipientPhone: event.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`${idPrefix}-wedding`}>Wedding or booking</Label>
                    <Input id={`${idPrefix}-wedding`} value={draft.weddingName} onChange={(event) => updateDraft({ weddingName: event.target.value })} />
                  </div>
                  <AdditionalRecipientEmailsInput
                    idPrefix={idPrefix}
                    primaryEmail={draft.recipientEmail}
                    value={draft.additionalRecipientEmails}
                    onChange={(additionalRecipientEmails) => updateDraft({ additionalRecipientEmails })}
                  />
                </div>
              </details>
            </div>
          </div>
          <div className="grid content-start gap-4 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-issue-date`}>{isReceipt ? 'Payment date' : 'Issue date'}</Label>
              <Input id={`${idPrefix}-issue-date`} type="date" value={draft.issueDate} onChange={(event) => updateDraft({ issueDate: event.target.value })} />
              {!draft.issueDate && <p className="text-xs text-destructive">Choose a date.</p>}
            </div>
            {!isReceipt && (
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-due-date`}>Due date</Label>
                <Input id={`${idPrefix}-due-date`} type="date" value={draft.dueDate} onChange={(event) => updateDraft({ dueDate: event.target.value })} />
                {!draft.dueDate && <p className="text-xs text-destructive">Choose when payment is due.</p>}
              </div>
            )}
            <div className="space-y-2 sm:col-span-2 md:col-span-1 lg:col-span-2">
              <Label htmlFor={`${idPrefix}-status`}>Document status</Label>
              <Select value={draft.status} onValueChange={(value) => updateDraft({ status: value as CommercialDocumentStatus })}>
                <SelectTrigger id={`${idPrefix}-status`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {commercialDocumentStatusOptionsFor(document.documentType).map((status) => (
                    <SelectItem key={status} value={status}>{commercialDocumentStatusLabel(status)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isReceipt ? (
          <div>
            <h3 className="font-display text-lg text-foreground sm:text-xl">Payment received</h3>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border/70 py-4 sm:mt-5 sm:gap-x-8 sm:gap-y-4 sm:py-5 lg:grid-cols-4">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Amount</dt>
                <dd className="mt-1 font-semibold text-foreground">{money(total)}</dd>
              </div>
              {receiptInvoiceNumber && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Invoice</dt>
                  <dd className="mt-1 text-foreground">{receiptInvoiceNumber}</dd>
                </div>
              )}
              {receiptPaymentMethod && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Method</dt>
                  <dd className="mt-1 text-foreground">{receiptPaymentMethod}</dd>
                </div>
              )}
              {receiptPaymentReference && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Reference</dt>
                  <dd className="mt-1 break-words text-foreground">{receiptPaymentReference}</dd>
                </div>
              )}
            </dl>
            {draft.notes.trim() && (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Payment note</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{draft.notes}</p>
              </div>
            )}
          </div>
        ) : (
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-lg text-foreground sm:text-xl">{isReceipt ? 'What was this payment for?' : 'What are you charging for?'}</h3>
            </div>
            <Button type="button" variant="outline" className="gap-2" onClick={() => setItems((current) => [...current, { description: '', quantity: 1, unitPrice: 0, sortOrder: current.length }])}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          </div>
          <div className="mt-5 overflow-x-auto">
            <div className="min-w-[660px]">
              <div className="grid grid-cols-[38px_1fr_110px_145px_120px_40px] gap-3 border-y border-border/70 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span>No.</span><span>Description</span><span>Qty</span><span>Price</span><span className="text-right">Total</span><span />
              </div>
              {items.map((item, index) => {
                const lineTotal = Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0);
                return (
                  <div key={`${index}-${item.sortOrder}`} className="grid grid-cols-[38px_1fr_110px_145px_120px_40px] items-center gap-3 border-b border-border/55 py-3">
                    <span className="text-sm text-muted-foreground">{index + 1}.</span>
                    <Input aria-label={`Item ${index + 1} description`} value={item.description} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} />
                    <QuantityInput aria-label={`Item ${index + 1} quantity`} value={Number(item.quantity ?? 1)} onValueChange={(quantity) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity } : row))} />
                    <CurrencyInput aria-label={`Item ${index + 1} price`} value={Number(item.unitPrice ?? 0)} onValueChange={(unitPrice) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice } : row))} />
                    <span className="text-right text-sm font-semibold text-foreground">{money(lineTotal)}</span>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${index + 1}`} onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          {!hasLineItems && (
            <p className="mt-3 text-sm text-destructive">Add at least one item with a description.</p>
          )}
        </div>
        )}

        <div className={isReceipt ? 'grid gap-6 border-t border-border/70 pt-6 md:gap-8 md:pt-8' : 'grid gap-6 border-t border-border/70 pt-6 md:gap-8 md:pt-8 lg:grid-cols-[1fr_360px]'}>
          {!isReceipt && (
          <section className="rounded-2xl border border-border/70">
            <h3 className="px-4 py-3 font-display text-lg text-foreground">Payment and notes</h3>
            <div className="space-y-5 border-t border-border/70 p-4">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-payment`}>How should the client pay?</Label>
              <Textarea id={`${idPrefix}-payment`} rows={3} placeholder="e.g. M-Pesa till or paybill, bank details, or payment instructions" value={draft.paymentInstructions} onChange={(event) => updateDraft({ paymentInstructions: event.target.value })} />
            </div>
            {document.documentType === 'invoice' && payoutAccounts.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-payout-account`}>Zania Pay payout account</Label>
                <Select value={payoutAccountId} onValueChange={(value) => void choosePayoutAccount(value)} disabled={savingPayout}>
                  <SelectTrigger id={`${idPrefix}-payout-account`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default payout account</SelectItem>
                    {payoutAccounts.map((account) => account.id ? (
                      <SelectItem key={account.id} value={account.id}>{account.settlementDestinationHint || 'Verified payout account'}{account.isDefault ? ' · Default' : ''}</SelectItem>
                    ) : null)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Locked once a Zania Pay payment starts.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-notes`}>Message to client · Optional</Label>
              <Textarea id={`${idPrefix}-notes`} rows={2} value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-terms`}>Terms and conditions · Optional</Label>
              <Textarea id={`${idPrefix}-terms`} rows={4} value={draft.terms} onChange={(event) => updateDraft({ terms: event.target.value })} />
            </div>
            </div>
          </section>
          )}
          <div className="space-y-4">
            <div className="space-y-3 border-b border-border/70 pb-5 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Subtotal</span><strong>{money(subtotal)}</strong></div>
              {!isReceipt && <div className="grid grid-cols-[1fr_180px] items-center gap-4"><Label htmlFor={`${idPrefix}-discount`}>Discount</Label><CurrencyInput id={`${idPrefix}-discount`} value={draft.discountAmount} onValueChange={(discountAmount) => updateDraft({ discountAmount })} /></div>}
              {!isReceipt && <div className="grid grid-cols-[1fr_180px] items-center gap-4"><Label htmlFor={`${idPrefix}-tax`}>Tax</Label><CurrencyInput id={`${idPrefix}-tax`} value={draft.taxAmount} onValueChange={(taxAmount) => updateDraft({ taxAmount })} /></div>}
            </div>
            <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
              <span className="font-medium">{isReceipt ? 'Amount received' : 'Total'}</span><strong className="text-xl">{money(total)}</strong>
            </div>
            <div className="space-y-2 pt-3">
              <Label htmlFor={`${idPrefix}-authorised`}>Authorised by · Optional</Label>
              <Input id={`${idPrefix}-authorised`} placeholder="Name or role" value={draft.authorisedBy} onChange={(event) => updateDraft({ authorisedBy: event.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-6">
          <div>
            <p className="text-sm text-muted-foreground">{isReceipt ? 'This receipt confirms the payment shown above.' : `Paid: ${money(document.amountPaid)} · Balance after saving: ${money(Math.max(0, total - document.amountPaid))}`}</p>
            {autosaveStatus !== 'idle' && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                {autosaveStatus === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {autosaveStatus === 'saved' ? <Check className="h-3.5 w-3.5 text-success" /> : null}
                {autosaveStatus === 'error' ? <CloudOff className="h-3.5 w-3.5 text-destructive" /> : null}
                <span>
                  {autosaveStatus === 'pending' ? 'Unsaved changes' : null}
                  {autosaveStatus === 'saving' ? 'Saving changes…' : null}
                  {autosaveStatus === 'saved' ? 'Changes saved automatically' : null}
                  {autosaveStatus === 'error' ? 'Autosave failed.' : null}
                </span>
                {autosaveStatus === 'error' && onRetryAutosave ? (
                  <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={onRetryAutosave}>Retry</button>
                ) : null}
              </div>
            )}
          </div>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isReceipt ? 'Save receipt' : 'Save document'}
          </Button>
        </div>
      </div>
    </section>
  );
}
