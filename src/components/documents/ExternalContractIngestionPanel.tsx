import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSearch, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  confirmExternalContractFacts,
  discardExternalContractIngestion,
  listAgreementOptions,
  listExternalContractIngestions,
  retryExternalContractAnalysis,
  uploadAndAnalyzeExternalContract,
  validateExternalContractFile,
  type ExternalContractFacts,
  type ExternalContractIngestion,
} from '@/lib/externalContracts';

const clauseFields: Array<[keyof ExternalContractFacts, string]> = [
  ['cancellation', 'Cancellation'],
  ['postponement', 'Postponement'],
  ['forceMajeure', 'Force majeure'],
  ['overtime', 'Overtime'],
  ['travel', 'Travel'],
  ['termination', 'Termination'],
  ['disputeResolution', 'Dispute resolution'],
];

function asDraft(facts: ExternalContractFacts): ExternalContractFacts {
  return {
    ...facts,
    paymentSchedule: facts.paymentSchedule.map((item) => ({ ...item })),
    serviceScope: [...facts.serviceScope],
    deliverables: [...facts.deliverables],
    unknowns: [...facts.unknowns],
  };
}

function ReviewCard({ ingestion, onChanged }: { ingestion: ExternalContractIngestion; onChanged: () => Promise<unknown> }) {
  const { toast } = useToast();
  const sourceFacts = ingestion.confirmed_data ?? ingestion.extracted_data;
  const [draft, setDraft] = useState<ExternalContractFacts | null>(sourceFacts ? asDraft(sourceFacts) : null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  useEffect(() => setDraft(sourceFacts ? asDraft(sourceFacts) : null), [ingestion.id, ingestion.status, sourceFacts]);

  const update = <K extends keyof ExternalContractFacts>(key: K, value: ExternalContractFacts[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };
  const retry = async () => {
    setRetrying(true);
    try {
      await retryExternalContractAnalysis(ingestion.id);
      await onChanged();
      toast({ title: 'Contract analysis ready', description: 'Review every extracted fact before confirming it.' });
    } catch (error) {
      toast({ title: 'Could not analyze contract', description: error instanceof Error ? error.message : 'Please retry.', variant: 'destructive' });
    } finally { setRetrying(false); }
  };
  const discard = async () => {
    setDiscarding(true);
    try {
      await discardExternalContractIngestion(ingestion);
      await onChanged();
      toast({ title: 'Upload discarded' });
    } catch (error) {
      toast({ title: 'Could not discard upload', description: error instanceof Error ? error.message : 'Please retry.', variant: 'destructive' });
    } finally { setDiscarding(false); }
  };
  const confirm = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await confirmExternalContractFacts(ingestion.id, draft);
      await onChanged();
      toast({ title: 'Contract facts confirmed', description: 'Zania can now use these reviewed facts for agreement guidance. No task or payment was created.' });
    } catch (error) {
      toast({ title: 'Could not confirm contract facts', description: error instanceof Error ? error.message : 'Check the values and retry.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (ingestion.status === 'processing' || ingestion.status === 'awaiting_upload') {
    return <article className="rounded-2xl border bg-card p-4"><p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin" />Analyzing {ingestion.original_filename}…</p><p className="mt-2 text-xs text-muted-foreground">The PDF is private and temporary.</p></article>;
  }
  if (ingestion.status === 'failed' || ingestion.status === 'extracted_pending_cleanup') {
    return <article className="rounded-2xl border bg-card p-4"><h3 className="font-medium">{ingestion.original_filename}</h3><p className="mt-2 text-sm text-muted-foreground">{ingestion.failure_message || 'Secure cleanup or analysis needs another attempt.'}</p><div className="mt-4 flex gap-2"><Button size="sm" onClick={() => void retry()} disabled={retrying}>{retrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Retry</Button><Button size="sm" variant="outline" onClick={() => void discard()} disabled={discarding}>Discard</Button></div></article>;
  }
  if (!draft) return null;
  const confirmed = ingestion.status === 'confirmed';

  return (
    <article className="space-y-5 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="font-semibold">{ingestion.original_filename}</h3><p className="mt-1 text-xs text-muted-foreground">{confirmed ? 'Confirmed contract facts' : `AI extraction · ${Math.round((draft.overallConfidence ?? 0) * 100)}% evidence confidence`}</p></div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{ingestion.agreement_id ? 'Linked to accepted quote' : 'Standalone review'}</span>
      </div>
      {!confirmed && <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950">Review and correct every value. Zania has not trusted these extracted facts yet, and this is not legal advice.</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        {([['vendorName', 'Vendor'], ['clientName', 'Client or couple'], ['eventDate', 'Event date'], ['location', 'Event location'], ['currency', 'Currency'], ['totalAmount', 'Total amount'], ['depositAmount', 'Deposit amount']] as Array<[keyof ExternalContractFacts, string]>).map(([key, label]) => (
          <div className="space-y-2" key={key}><Label htmlFor={`${ingestion.id}-${key}`}>{label}</Label><Input id={`${ingestion.id}-${key}`} type={key === 'eventDate' ? 'date' : 'text'} value={String(draft[key] ?? '')} disabled={confirmed} onChange={(event) => update(key, event.target.value || null as never)} /></div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h4 className="font-medium">Payment schedule</h4>{!confirmed && <Button type="button" size="sm" variant="outline" onClick={() => update('paymentSchedule', [...draft.paymentSchedule, { title: '', amount: '', dueDate: '', confidence: 1 }])}><Plus className="mr-2 h-4 w-4" />Add date</Button>}</div>
        {draft.paymentSchedule.length === 0 ? <p className="text-sm text-muted-foreground">No dated payments were extracted.</p> : draft.paymentSchedule.map((payment, index) => (
          <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1.2fr_0.7fr_0.8fr_auto] sm:items-end" key={index}>
            <div className="space-y-1"><Label htmlFor={`${ingestion.id}-payment-title-${index}`}>Payment</Label><Input id={`${ingestion.id}-payment-title-${index}`} value={payment.title} disabled={confirmed} onChange={(event) => update('paymentSchedule', draft.paymentSchedule.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></div>
            <div className="space-y-1"><Label htmlFor={`${ingestion.id}-payment-amount-${index}`}>Amount</Label><Input id={`${ingestion.id}-payment-amount-${index}`} value={payment.amount} disabled={confirmed} inputMode="decimal" onChange={(event) => update('paymentSchedule', draft.paymentSchedule.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} /></div>
            <div className="space-y-1"><Label htmlFor={`${ingestion.id}-payment-date-${index}`}>Due date</Label><Input id={`${ingestion.id}-payment-date-${index}`} type="date" value={payment.dueDate} disabled={confirmed} onChange={(event) => update('paymentSchedule', draft.paymentSchedule.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value } : item))} /></div>
            {!confirmed && <Button type="button" size="icon" variant="ghost" aria-label={`Remove payment ${index + 1}`} onClick={() => update('paymentSchedule', draft.paymentSchedule.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor={`${ingestion.id}-scope`}>Service scope, one item per line</Label><Textarea id={`${ingestion.id}-scope`} value={draft.serviceScope.join('\n')} disabled={confirmed} onChange={(event) => update('serviceScope', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} /></div>
        <div className="space-y-2"><Label htmlFor={`${ingestion.id}-deliverables`}>Deliverables, one item per line</Label><Textarea id={`${ingestion.id}-deliverables`} value={draft.deliverables.join('\n')} disabled={confirmed} onChange={(event) => update('deliverables', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} /></div>
      </div>
      <details><summary className="cursor-pointer text-sm font-medium">Review contract clauses</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{clauseFields.map(([key, label]) => <div className="space-y-2" key={key}><Label htmlFor={`${ingestion.id}-${key}`}>{label}</Label><Textarea id={`${ingestion.id}-${key}`} value={String(draft[key] ?? '')} disabled={confirmed} onChange={(event) => update(key, event.target.value || null as never)} /></div>)}</div></details>
      {draft.unknowns.length > 0 && <div><h4 className="text-sm font-medium">Needs human review</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{draft.unknowns.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
      {!confirmed && <div className="flex flex-wrap gap-2"><Button onClick={() => void confirm()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm reviewed facts</Button><Button variant="outline" onClick={() => void discard()} disabled={discarding}>Discard extraction</Button></div>}
      {confirmed && <p className="text-sm text-muted-foreground">These reviewed facts are available to Agreement Intelligence. Any reminder or payment action still requires its own explicit confirmation.</p>}
    </article>
  );
}

export default function ExternalContractIngestionPanel({ weddingId, enabled }: { weddingId: string; enabled: boolean }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [agreementId, setAgreementId] = useState('none');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ingestions = useQuery({ queryKey: ['external-contract-ingestions', weddingId], queryFn: () => listExternalContractIngestions(weddingId), enabled: Boolean(weddingId && enabled) });
  const agreements = useQuery({ queryKey: ['external-contract-agreements', weddingId], queryFn: () => listAgreementOptions(weddingId), enabled: Boolean(weddingId && enabled) });
  const upload = async () => {
    if (!file) return;
    const validation = validateExternalContractFile(file);
    if (validation) { toast({ title: 'Cannot upload contract', description: validation, variant: 'destructive' }); return; }
    setUploading(true);
    try {
      await uploadAndAnalyzeExternalContract({ weddingId, agreementId: agreementId === 'none' ? null : agreementId, file });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await ingestions.refetch();
      toast({ title: 'Contract analysis ready', description: 'Review and confirm the extracted facts below.' });
    } catch (error) {
      await ingestions.refetch();
      toast({ title: 'Could not analyze contract', description: error instanceof Error ? error.message : 'Please retry.', variant: 'destructive' });
    } finally { setUploading(false); }
  };

  if (!enabled) return null;
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="external-contract-heading">
      <div className="flex items-start gap-3"><FileSearch className="mt-0.5 h-5 w-5 text-primary" /><div><h2 id="external-contract-heading" className="text-lg font-semibold">Analyze an external vendor contract</h2><p className="mt-1 text-sm text-muted-foreground">Upload a private PDF, review Zania’s extraction, and confirm only the facts you trust. The source PDF is deleted after successful extraction.</p></div></div>
      <div className="grid gap-4 sm:grid-cols-[1fr_0.8fr_auto] sm:items-end">
        <div className="space-y-2"><Label htmlFor="external-contract-file">Vendor contract PDF</Label><Input ref={fileInputRef} id="external-contract-file" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></div>
        <div className="space-y-2"><Label htmlFor="external-contract-agreement">Compare with accepted quote</Label><Select value={agreementId} onValueChange={setAgreementId}><SelectTrigger id="external-contract-agreement"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No accepted quote selected</SelectItem>{(agreements.data ?? []).map((agreement) => <SelectItem key={agreement.id} value={agreement.id}>{agreement.vendorName} · {agreement.title}</SelectItem>)}</SelectContent></Select></div>
        <Button onClick={() => void upload()} disabled={!file || uploading}>{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Upload & analyze</Button>
      </div>
      <p className="text-xs text-muted-foreground">PDF only · maximum 10 MB · analysis is guidance, not legal advice.</p>
      {ingestions.isError && <p role="alert" className="text-sm text-destructive">Could not load uploaded contract reviews.</p>}
      {(ingestions.data ?? []).length > 0 && <div className="space-y-4 border-t pt-5">{(ingestions.data ?? []).map((ingestion) => <ReviewCard key={ingestion.id} ingestion={ingestion} onChanged={() => ingestions.refetch()} />)}</div>}
    </section>
  );
}
