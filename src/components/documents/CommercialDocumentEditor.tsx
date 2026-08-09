import type { Dispatch, SetStateAction } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  commercialDocumentTypeLabel,
  type CommercialDocumentDetail,
  type CommercialDocumentStatus,
  type SaveCommercialDocumentItemInput,
} from '@/lib/commercialDocuments';

export type CommercialDocumentHeaderDraft = {
  title: string;
  status: CommercialDocumentStatus;
  recipientName: string;
  recipientEmail: string;
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
}: Props) {
  const isReceipt = document.documentType === 'receipt';
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0),
    0,
  );
  const total = isReceipt
    ? subtotal
    : Math.max(0, subtotal - Number(draft.discountAmount || 0) + Number(draft.taxAmount || 0));
  const hasLineItems = items.some(
    (item) => item.description.trim() && Number(item.quantity ?? 1) > 0 && Number(item.unitPrice ?? 0) > 0,
  );
  const missingRequiredFields = [
    !draft.title.trim() && 'title',
    !draft.recipientName.trim() && 'client name',
    !draft.issueDate && (isReceipt ? 'payment date' : 'issue date'),
    !isReceipt && !draft.dueDate && 'due date',
    !hasLineItems && 'priced item',
  ].filter(Boolean) as string[];
  const updateDraft = (patch: Partial<CommercialDocumentHeaderDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  return (
    <section className="overflow-hidden border border-border/80 bg-[#fffdf9] shadow-[0_18px_44px_rgba(55,42,34,0.08)]">
      <div className="grid gap-8 bg-primary px-6 py-7 text-primary-foreground md:grid-cols-[1.35fr_0.65fr] md:px-8">
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
          <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/76">
            Edit the document directly. The preview will use this same information.
          </p>
        </div>
        <div className="space-y-2 md:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/72">From</p>
          <p className="text-sm leading-6 text-primary-foreground/88">
            Your business details are filled from your Zania profile and remain consistent on every document.
          </p>
        </div>
      </div>

      <div className="space-y-8 p-6 md:p-8">
        <div className="grid gap-6 border-b border-border/70 pb-8 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{isReceipt ? 'Received from' : 'Bill to'}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`${idPrefix}-recipient`}>Client or couple <span className="text-destructive">*</span></Label>
                <Input id={`${idPrefix}-recipient`} value={draft.recipientName} onChange={(event) => updateDraft({ recipientName: event.target.value })} />
                {!draft.recipientName.trim() && <p className="text-xs text-destructive">Add the person receiving this document.</p>}
              </div>
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

        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-xl text-foreground">{isReceipt ? 'What was this payment for?' : 'What are you charging for?'}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{isReceipt ? 'List the deposit, instalment, or service this payment covers.' : 'Add one clear line for each service or deliverable.'}</p>
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
                    <Input aria-label={`Item ${index + 1} quantity`} type="number" min="1" value={String(item.quantity ?? 1)} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: Number(event.target.value || 1) } : row))} />
                    <Input aria-label={`Item ${index + 1} price`} type="number" min="0" value={String(item.unitPrice ?? 0)} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, unitPrice: Number(event.target.value || 0) } : row))} />
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
            <p className="mt-3 text-sm text-destructive">Add at least one item with a description and price.</p>
          )}
        </div>

        <div className="grid gap-8 border-t border-border/70 pt-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-payment`}>{isReceipt ? 'Payment method or reference' : 'How should the client pay?'}</Label>
              <Textarea id={`${idPrefix}-payment`} rows={3} placeholder={isReceipt ? 'e.g. M-Pesa transaction code, bank reference, cash, or card' : 'e.g. M-Pesa till or paybill, bank details, or payment instructions'} value={draft.paymentInstructions} onChange={(event) => updateDraft({ paymentInstructions: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-notes`}>{isReceipt ? 'Receipt note · Optional' : 'Message to client · Optional'}</Label>
              <Textarea id={`${idPrefix}-notes`} rows={2} value={draft.notes} onChange={(event) => updateDraft({ notes: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-terms`}>{isReceipt ? 'Additional details · Optional' : 'Terms and conditions · Optional'}</Label>
              <Textarea id={`${idPrefix}-terms`} rows={4} value={draft.terms} onChange={(event) => updateDraft({ terms: event.target.value })} />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-3 border-b border-border/70 pb-5 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Subtotal</span><strong>{money(subtotal)}</strong></div>
              {!isReceipt && <div className="grid grid-cols-[1fr_150px] items-center gap-4"><Label htmlFor={`${idPrefix}-discount`}>Discount</Label><Input id={`${idPrefix}-discount`} type="number" min="0" value={String(draft.discountAmount)} onChange={(event) => updateDraft({ discountAmount: Number(event.target.value || 0) })} /></div>}
              {!isReceipt && <div className="grid grid-cols-[1fr_150px] items-center gap-4"><Label htmlFor={`${idPrefix}-tax`}>Tax</Label><Input id={`${idPrefix}-tax`} type="number" min="0" value={String(draft.taxAmount)} onChange={(event) => updateDraft({ taxAmount: Number(event.target.value || 0) })} /></div>}
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
            {missingRequiredFields.length > 0 && (
              <p className="mt-1 text-xs text-destructive">
                Still needed: {missingRequiredFields.join(', ')}.
              </p>
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
