import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, ArrowRight, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import MarkdownEditor from '@/components/documents/MarkdownEditor';
import DocumentAutosaveStatus from '@/components/documents/DocumentAutosaveStatus';
import AdditionalRecipientEmailsInput from '@/components/documents/AdditionalRecipientEmailsInput';
import ContactRecipientPicker from '@/components/documents/ContactRecipientPicker';
import type { DocumentAutosaveStatus as AutosaveStatus } from '@/hooks/useDocumentAutosave';
import { getContractPlaceholders, type ContractPlaceholder } from '@/lib/contractPlaceholders';
import {
  professionalContractStatusLabel,
  type ProfessionalContractRecord,
  type ProfessionalContractStatus,
} from '@/lib/commercialDocuments';

export type ContractDocumentDraft = {
  title: string;
  status: ProfessionalContractStatus;
  recipientName: string;
  recipientEmail: string;
  additionalRecipientEmails: string[];
  recipientPhone: string;
  weddingName: string;
  clientId: string;
  vendorListingId: string;
  vendorId: string;
  eventDate: string;
  currency: string;
  totalAmount: string;
  depositAmount: string;
  paymentSchedule: Array<{ title: string; amount: string; dueDate: string }>;
  summary: string;
  terms: string;
  notes: string;
};

type Props = {
  contract: ProfessionalContractRecord;
  draft: ContractDocumentDraft;
  setDraft: Dispatch<SetStateAction<ContractDocumentDraft | null>>;
  saving: boolean;
  locked?: boolean;
  onSave: () => void | Promise<void>;
  autosaveStatus?: AutosaveStatus;
  onRetryAutosave?: () => void;
  onFlushAutosave?: () => void;
  placeholderFocus?: (ContractPlaceholder & { requestId: number }) | null;
  onPlaceholderFocus: (placeholder: ContractPlaceholder) => void;
};

export default function ContractDocumentEditor({ contract, draft, setDraft, saving, locked = false, onSave, autosaveStatus = 'idle', onRetryAutosave, onFlushAutosave, placeholderFocus, onPlaceholderFocus }: Props) {
  const placeholders = useMemo(
    () => getContractPlaceholders({ summary: '', terms: draft.terms }),
    [draft.terms],
  );

  const updateDraft = (patch: Partial<ContractDocumentDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const updatePayment = (index: number, patch: Partial<ContractDocumentDraft['paymentSchedule'][number]>) => {
    setDraft((current) => current ? {
      ...current,
      paymentSchedule: current.paymentSchedule.map((payment, paymentIndex) => (
        paymentIndex === index ? { ...payment, ...patch } : payment
      )),
    } : current);
  };

  return (
    <fieldset disabled={locked} onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onFlushAutosave?.();
    }} className="overflow-hidden border border-border/80 bg-[#fffdf9] shadow-[0_18px_44px_rgba(55,42,34,0.08)] disabled:opacity-100">
      <header className="bg-primary px-6 py-7 text-primary-foreground md:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/72">Service agreement</p>
          <Label htmlFor="contract-document-title" className="sr-only">Contract title</Label>
          <Input
            id="contract-document-title"
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            className="mt-3 h-auto border-0 bg-transparent px-0 font-display text-3xl font-semibold text-primary-foreground shadow-none focus-visible:ring-primary-foreground/35"
          />
        </div>
      </header>

      <div className="space-y-8 p-6 md:p-8">
        {!locked && placeholders.length > 0 && (
          <section className="border border-warning/35 bg-[hsl(var(--warning-soft))] px-4 py-4" aria-labelledby="contract-missing-details-title">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <h3 id="contract-missing-details-title" className="font-semibold text-foreground">Finish these details</h3>
                <p className="mt-1 text-sm text-muted-foreground">Choose each item, then replace the highlighted words.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {placeholders.map((placeholder) => (
                    <button
                      key={placeholder.id}
                      type="button"
                      onClick={() => onPlaceholderFocus(placeholder)}
                      className="flex min-h-11 items-center justify-between gap-3 border border-warning/30 bg-background px-3 py-2 text-left text-sm font-medium text-foreground transition hover:border-warning/60 hover:bg-background/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>
                        {placeholder.label}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          Agreement details
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        <div className="grid gap-7 border-b border-border/70 pb-8 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Agreement with</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contract-recipient">Client or couple</Label>
                <ContactRecipientPicker
                  id="contract-recipient"
                  value={draft.recipientName}
                  disabled={locked}
                  onChange={(recipientName) => updateDraft({ recipientName })}
                  onSelect={(contact) => updateDraft({
                    recipientName: contact.displayName,
                    recipientEmail: contact.primaryEmail ?? draft.recipientEmail,
                    recipientPhone: contact.phone ?? draft.recipientPhone,
                    additionalRecipientEmails: contact.additionalEmails,
                  })}
                />
              </div>
              <details className="sm:col-span-2 rounded-2xl border border-border/70">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none">Contact details</summary>
                <div className="grid gap-4 border-t border-border/70 p-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="contract-email">Email</Label>
                    <Input id="contract-email" type="email" value={draft.recipientEmail} onChange={(event) => updateDraft({ recipientEmail: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contract-phone">Phone</Label>
                    <Input id="contract-phone" value={draft.recipientPhone} onChange={(event) => updateDraft({ recipientPhone: event.target.value })} />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="contract-wedding">Wedding or booking</Label>
                    <Input id="contract-wedding" value={draft.weddingName} onChange={(event) => updateDraft({ weddingName: event.target.value })} />
                  </div>
                  <AdditionalRecipientEmailsInput
                    idPrefix="contract"
                    primaryEmail={draft.recipientEmail}
                    value={draft.additionalRecipientEmails}
                    onChange={(additionalRecipientEmails) => updateDraft({ additionalRecipientEmails })}
                    disabled={locked}
                    contractCopy
                  />
                </div>
              </details>
            </div>
          </div>
          <div className="grid content-start gap-4">
            <div className="space-y-2">
              <Label htmlFor="contract-event-date">Wedding or event date</Label>
              <Input id="contract-event-date" type="date" value={draft.eventDate} onChange={(event) => updateDraft({ eventDate: event.target.value })} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Agreement stage</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{professionalContractStatusLabel(contract.status)}</p>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Created {new Date(contract.createdAt).toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        <section className="space-y-4 border-b border-border/70 pb-8" aria-labelledby="contract-financial-terms-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="contract-financial-terms-title" className="font-display text-xl">Financial terms</h3>
              <p className="mt-1 text-sm text-muted-foreground">These structured values let Zania check the agreement and prepare reminders without guessing from contract wording.</p>
            </div>
            {!locked ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => updateDraft({ paymentSchedule: [...draft.paymentSchedule, { title: '', amount: '', dueDate: '' }] })}
              >
                <Plus className="h-4 w-4" /> Add payment date
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="contract-currency">Currency</Label>
              <Input id="contract-currency" maxLength={3} value={draft.currency} onChange={(event) => updateDraft({ currency: event.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-total">Total contract amount</Label>
              <Input id="contract-total" type="number" min="0" step="0.01" inputMode="decimal" value={draft.totalAmount} onChange={(event) => updateDraft({ totalAmount: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-deposit">Deposit amount</Label>
              <Input id="contract-deposit" type="number" min="0" step="0.01" inputMode="decimal" value={draft.depositAmount} onChange={(event) => updateDraft({ depositAmount: event.target.value })} />
            </div>
          </div>

          {draft.paymentSchedule.length ? (
            <div className="space-y-3">
              {draft.paymentSchedule.map((payment, index) => (
                <div key={index} className="grid gap-3 rounded-2xl border border-border/70 p-4 sm:grid-cols-[1.3fr_0.7fr_0.8fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`contract-payment-title-${index}`}>Payment</Label>
                    <Input id={`contract-payment-title-${index}`} value={payment.title} onChange={(event) => updatePayment(index, { title: event.target.value })} placeholder="Booking deposit" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`contract-payment-amount-${index}`}>Amount</Label>
                    <Input id={`contract-payment-amount-${index}`} type="number" min="0.01" step="0.01" inputMode="decimal" value={payment.amount} onChange={(event) => updatePayment(index, { amount: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`contract-payment-date-${index}`}>Due date</Label>
                    <Input id={`contract-payment-date-${index}`} type="date" value={payment.dueDate} onChange={(event) => updatePayment(index, { dueDate: event.target.value })} />
                  </div>
                  {!locked ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${payment.title || `payment ${index + 1}`}`}
                      onClick={() => updateDraft({ paymentSchedule: draft.paymentSchedule.filter((_, paymentIndex) => paymentIndex !== index) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">No structured payment dates recorded yet.</p>
          )}
        </section>

        <div className="space-y-2">
          <Label htmlFor="contract-terms" className="font-display text-xl">Agreement details</Label>
          <MarkdownEditor
            id="contract-terms"
            rows={14}
            value={draft.terms}
            onChange={(terms) => updateDraft({ terms })}
            disabled={locked}
            ariaLabel="Agreement details"
            selection={placeholderFocus?.field === 'terms' ? placeholderFocus : null}
            placeholder={'## Services\nDescribe what is included.\n\n## Fees and payment\nAdd the agreed cost and payment schedule.\n\n## Changes or cancellation\nExplain what happens if plans change.'}
          />
        </div>

        {locked ? (
          <p className="border-t border-border/70 pt-6 text-sm text-muted-foreground">
            This sent contract is locked. Create a new contract if the terms need to change.
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-6">
            <DocumentAutosaveStatus status={autosaveStatus} onRetry={onRetryAutosave} />
            <Button onClick={onSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save contract
            </Button>
          </div>
        )}
      </div>
    </fieldset>
  );
}
