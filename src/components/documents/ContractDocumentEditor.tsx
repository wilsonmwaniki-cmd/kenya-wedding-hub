import type { Dispatch, SetStateAction } from 'react';
import { Loader2, Save } from 'lucide-react';
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
  professionalContractStatusLabel,
  professionalContractStatusOptions,
  type ProfessionalContractRecord,
  type ProfessionalContractStatus,
} from '@/lib/commercialDocuments';

export type ContractDocumentDraft = {
  title: string;
  status: ProfessionalContractStatus;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  weddingName: string;
  clientId: string;
  vendorListingId: string;
  vendorId: string;
  eventDate: string;
  summary: string;
  terms: string;
  notes: string;
};

type Props = {
  contract: ProfessionalContractRecord;
  draft: ContractDocumentDraft;
  setDraft: Dispatch<SetStateAction<ContractDocumentDraft | null>>;
  saving: boolean;
  onSave: () => void | Promise<void>;
};

export default function ContractDocumentEditor({ contract, draft, setDraft, saving, onSave }: Props) {
  const updateDraft = (patch: Partial<ContractDocumentDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  return (
    <section className="overflow-hidden border border-border/80 bg-[#fffdf9] shadow-[0_18px_44px_rgba(55,42,34,0.08)]">
      <header className="grid gap-8 bg-primary px-6 py-7 text-primary-foreground md:grid-cols-[1.35fr_0.65fr] md:px-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/72">Service agreement</p>
          <Label htmlFor="contract-document-title" className="sr-only">Contract title</Label>
          <Input
            id="contract-document-title"
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            className="mt-3 h-auto border-0 bg-transparent px-0 font-display text-3xl font-semibold text-primary-foreground shadow-none focus-visible:ring-primary-foreground/35"
          />
          <p className="mt-2 max-w-xl text-sm leading-6 text-primary-foreground/76">
            Edit the agreement directly, then preview it before asking anyone to sign.
          </p>
        </div>
        <div className="space-y-2 md:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/72">Prepared by</p>
          <p className="text-sm leading-6 text-primary-foreground/88">Your business name and contact details come from your Zania profile.</p>
        </div>
      </header>

      <div className="space-y-8 p-6 md:p-8">
        <div className="grid gap-7 border-b border-border/70 pb-8 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Agreement with</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="contract-recipient">Client or couple</Label>
                <Input id="contract-recipient" value={draft.recipientName} onChange={(event) => updateDraft({ recipientName: event.target.value })} />
              </div>
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
            </div>
          </div>
          <div className="grid content-start gap-4">
            <div className="space-y-2">
              <Label htmlFor="contract-event-date">Wedding or event date</Label>
              <Input id="contract-event-date" type="date" value={draft.eventDate} onChange={(event) => updateDraft({ eventDate: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contract-status">Agreement stage</Label>
              <Select value={draft.status} onValueChange={(value) => updateDraft({ status: value as ProfessionalContractStatus })}>
                <SelectTrigger id="contract-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {professionalContractStatusOptions.map((status) => (
                    <SelectItem key={status} value={status}>{professionalContractStatusLabel(status)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">Created {new Date(contract.createdAt).toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contract-summary" className="font-display text-xl">What are we agreeing to?</Label>
          <p className="text-sm text-muted-foreground">Describe the service, deliverables, and important dates in plain language.</p>
          <Textarea id="contract-summary" rows={5} value={draft.summary} onChange={(event) => updateDraft({ summary: event.target.value })} placeholder="For example: full wedding planning, supplier coordination, and wedding-day management." />
        </div>

        <div className="space-y-2 border-t border-border/70 pt-8">
          <Label htmlFor="contract-terms" className="font-display text-xl">Agreement details</Label>
          <p className="text-sm text-muted-foreground">Add fees, payment dates, cancellations, responsibilities, and anything both sides should understand.</p>
          <Textarea id="contract-terms" rows={14} value={draft.terms} onChange={(event) => updateDraft({ terms: event.target.value })} placeholder={'1. Services\nDescribe what is included.\n\n2. Fees and payment\nAdd the agreed cost and payment schedule.\n\n3. Changes or cancellation\nExplain what happens if plans change.'} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-6">
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">Save your changes first. Preview shows exactly what the client will read; private notes and workflow controls stay outside the agreement.</p>
          <Button onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save contract
          </Button>
        </div>
      </div>
    </section>
  );
}
