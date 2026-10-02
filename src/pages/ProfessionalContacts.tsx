import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookUser, ChevronRight, Loader2, Mail, Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  createProfessionalContact,
  deleteProfessionalContact,
  listProfessionalContacts,
  mergeProfessionalContacts,
  professionalContactTypes,
  updateProfessionalContact,
  type ProfessionalContact,
  type ProfessionalContactInput,
  type ProfessionalContactType,
} from '@/lib/professionalContacts';
import {
  getCommercialDocument,
  listCommercialDocumentEmailEvents,
  listCommercialDocuments,
  listProfessionalContracts,
  professionalTemplateTypeLabel,
  type CommercialDocumentDetail,
  type CommercialDocumentEmailEvent,
  type CommercialDocumentRecord,
  type CommercialDocumentRole,
  type ProfessionalContractRecord,
} from '@/lib/commercialDocuments';

const emptyDraft: ProfessionalContactInput = { contactType: 'client', displayName: '', primaryEmail: '', phone: '', additionalEmails: [], notes: '' };

function belongsToContact(contact: ProfessionalContact, recipientName: string, recipientEmail: string | null) {
  const emails = [contact.primaryEmail, ...contact.additionalEmails]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());
  if (recipientEmail && emails.includes(recipientEmail.trim().toLowerCase())) return true;
  return emails.length === 0 && recipientName.trim().toLowerCase() === contact.displayName.trim().toLowerCase();
}

type ClientPipelineStage = 'new_enquiry' | 'follow_up' | 'quote_sent' | 'deposit_due' | 'booked';

type ClientPipelineState = {
  stage: ClientPipelineStage;
  label: string;
  nextAction: string;
};

function pipelineForClient(contact: ProfessionalContact, documents: CommercialDocumentRecord[]): ClientPipelineState {
  const records = documents.filter((document) => belongsToContact(contact, document.recipientName, document.recipientEmail));
  const quotes = records.filter((document) => document.documentType === 'quote');
  const invoices = records.filter((document) => document.documentType === 'invoice');

  if (records.length === 0) return { stage: 'new_enquiry', label: 'New enquiry', nextAction: 'Start with a quote' };
  if (quotes.some((document) => document.status === 'changes_requested')) return { stage: 'follow_up', label: 'Follow up', nextAction: 'Review quote changes' };
  if (invoices.some((document) => document.balanceDue > 0 && document.status !== 'draft')) return { stage: 'deposit_due', label: 'Deposit due', nextAction: 'Follow up on payment' };
  if (invoices.some((document) => document.amountPaid > 0 || document.status === 'paid')) return { stage: 'booked', label: 'Booked', nextAction: 'Prepare the next client step' };
  if (quotes.some((document) => document.status === 'sent')) return { stage: 'quote_sent', label: 'Quote sent', nextAction: 'Wait for a reply' };
  return { stage: 'follow_up', label: 'Follow up', nextAction: 'Choose the next client action' };
}

function ClientWorkspaceDialog({ contact, role, open, onOpenChange }: {
  contact: ProfessionalContact | null;
  role: CommercialDocumentRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [documents, setDocuments] = useState<CommercialDocumentDetail[]>([]);
  const [contracts, setContracts] = useState<ProfessionalContractRecord[]>([]);
  const [emailEvents, setEmailEvents] = useState<CommercialDocumentEmailEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documentPath = role === 'planner' ? '/planner-documents' : '/vendor-documents';

  useEffect(() => {
    if (!open || !contact) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([listCommercialDocuments({ role }), listProfessionalContracts({ role })])
      .then(async ([allDocuments, allContracts]) => {
        const matchingDocuments = allDocuments.filter((document) => belongsToContact(contact, document.recipientName, document.recipientEmail));
        const [details, history] = await Promise.all([
          Promise.all(matchingDocuments.map((document) => getCommercialDocument(document.id))),
          Promise.all(matchingDocuments.map((document) => listCommercialDocumentEmailEvents(document.id))),
        ]);
        if (cancelled) return;
        setDocuments(details.filter((document): document is CommercialDocumentDetail => Boolean(document)));
        setEmailEvents(history.flat());
        setContracts(allContracts.filter((contract) => belongsToContact(contact, contract.recipientName, contract.recipientEmail)));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load this client history.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [contact, open, role]);

  const payments = documents.flatMap((document) => document.payments.map((payment) => ({ ...payment, documentNumber: document.documentNumber })));
  const documentsWithContracts = [
    ...documents.map((document) => ({ id: document.id, type: document.documentType, title: document.title, number: document.documentNumber, status: document.status, date: document.issueDate, amount: document.totalAmount })),
    ...contracts.map((contract) => ({ id: contract.id, type: 'contract', title: contract.title, number: 'Contract', status: contract.status, date: contract.sentAt || contract.createdAt, amount: null as number | null })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-2xl overflow-x-hidden overflow-y-auto p-0 sm:w-full">
        {contact && <>
          <DialogHeader className="border-b border-border/70 px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Client workspace</p>
            <DialogTitle className="mt-1 text-2xl">{contact.displayName}</DialogTitle>
            <DialogDescription>{contact.primaryEmail || contact.phone || 'Contact details not added yet.'}</DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-7 px-5 py-5 sm:px-6">
            <section className="border-y border-border/70 py-4" aria-label="Client activity summary">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Activity at a glance</p>
              <div className="mt-3 grid grid-cols-2 divide-x divide-y divide-border/70 border border-border/70 sm:grid-cols-4 sm:divide-y-0">
                <div className="p-3"><p className="text-xs text-muted-foreground">Quotes</p><p className="mt-1 text-2xl font-semibold tabular-nums">{documents.filter((item) => item.documentType === 'quote').length}</p></div>
                <div className="p-3"><p className="text-xs text-muted-foreground">Invoices</p><p className="mt-1 text-2xl font-semibold tabular-nums">{documents.filter((item) => item.documentType === 'invoice').length}</p></div>
                <div className="p-3"><p className="text-xs text-muted-foreground">Contracts</p><p className="mt-1 text-2xl font-semibold tabular-nums">{contracts.length}</p></div>
                <div className="p-3"><p className="text-xs text-muted-foreground">Payments received</p><p className="mt-1 text-2xl font-semibold tabular-nums">{payments.length}</p></div>
              </div>
            </section>

            {loading ? <div className="flex items-center gap-2 border-y border-border/70 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading this client’s history…</div> : error ? <p className="border-l-2 border-destructive py-2 pl-3 text-sm text-destructive">{error}</p> : <>
              <section>
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="font-display text-lg font-semibold">Documents</h3><p className="mt-1 text-sm text-muted-foreground">Open any record to see the full document.</p></div><Button asChild variant="outline" size="sm" className="w-full sm:w-auto"><Link to={documentPath} state={{ createDocumentRecipientName: contact.displayName, createDocumentRecipientEmail: contact.primaryEmail, createDocumentRecipientPhone: contact.phone }}>Create document</Link></Button></div>
                {documentsWithContracts.length === 0 ? <div className="mt-3 border-y border-border/70 py-5 text-sm text-muted-foreground">No quotes, invoices, contracts, or receipts are linked to this client yet.</div> : <div className="mt-3 divide-y divide-border/70 border-y border-border/70">{documentsWithContracts.map((item) => <Link key={`${item.type}-${item.id}`} to={item.type === 'contract' ? `${documentPath}/contracts` : documentPath} state={item.type === 'contract' ? { openContractId: item.id } : { openDocumentId: item.id }} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-4 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{professionalTemplateTypeLabel(item.type)}</p><p className="mt-1 truncate text-sm font-medium text-foreground">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.number} · {item.status.replaceAll('_', ' ')}</p></div><div className="flex min-w-0 items-center gap-1 text-right text-xs text-muted-foreground"><div className="min-w-0"><p className="whitespace-nowrap">{new Date(item.date).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</p>{item.amount !== null && <p className="mt-1 whitespace-nowrap font-medium text-foreground">KES {item.amount.toLocaleString()}</p>}</div><ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" /></div></Link>)}</div>}
              </section>

              <section>
                <h3 className="font-display text-lg font-semibold">Payments</h3><p className="mt-1 text-sm text-muted-foreground">Recorded payments from this client’s invoices.</p>
                {payments.length === 0 ? <div className="mt-3 border-y border-border/70 py-5 text-sm text-muted-foreground">No payments recorded yet.</div> : <div className="mt-3 divide-y divide-border/70 border-y border-border/70">{payments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)).map((payment) => <Link key={payment.id} to={documentPath} state={{ openDocumentId: payment.documentId, focus: 'payment', focusedPaymentId: payment.id }} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-4 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{payment.documentNumber}</p><p className="mt-1 truncate text-xs text-muted-foreground">{payment.paymentMethod === 'mpesa' ? 'M-Pesa' : payment.paymentMethod} · {payment.reference || 'No reference'}</p></div><div className="flex items-center gap-1 text-right"><div><p className="whitespace-nowrap text-sm font-semibold text-foreground">KES {payment.amount.toLocaleString()}</p><p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{new Date(payment.paymentDate).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</p></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></div></Link>)}</div>}
              </section>

              <section>
                <h3 className="font-display text-lg font-semibold">Communication</h3><p className="mt-1 text-sm text-muted-foreground">Emails sent from Zania for this client’s documents.</p>
                {emailEvents.length === 0 ? <div className="mt-3 border-y border-border/70 py-5 text-sm text-muted-foreground">No document emails sent yet.</div> : <div className="mt-3 divide-y divide-border/70 border-y border-border/70">{emailEvents.sort((a, b) => b.sentAt.localeCompare(a.sentAt)).map((event) => <Link key={event.id} to={documentPath} state={{ openDocumentId: event.documentId }} className="flex items-start justify-between gap-4 py-4 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{event.subject}</p><p className="mt-1 text-xs text-muted-foreground">Sent to {event.recipientEmail} · {new Date(event.sentAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></Link>)}</div>}
              </section>
            </>}
          </div>
        </>}
      </DialogContent>
    </Dialog>
  );
}

function ContactDialog({ contact, open, onOpenChange, onSaved }: {
  contact: ProfessionalContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (contact: ProfessionalContact) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [draft, setDraft] = useState<ProfessionalContactInput>(emptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(contact ? {
      contactType: contact.contactType,
      displayName: contact.displayName,
      organisationName: contact.organisationName ?? '',
      primaryEmail: contact.primaryEmail ?? '',
      phone: contact.phone ?? '',
      additionalEmails: contact.additionalEmails,
      notes: contact.notes ?? '',
      lastDocumentSentAt: contact.lastDocumentSentAt,
    } : emptyDraft);
  }, [contact, open]);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const saved = contact
        ? await updateProfessionalContact(contact.id, draft)
        : await createProfessionalContact(user.id, draft);
      onSaved(saved);
      onOpenChange(false);
      toast({ title: contact ? 'Contact updated' : 'Contact saved' });
    } catch (error) {
      toast({ title: 'Could not save contact', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{contact ? 'Edit contact' : 'Add contact'}</DialogTitle>
        <DialogDescription>Saved contacts are private to your professional account and can be reused in documents.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="contact-name">Name <span className="text-destructive">*</span></Label><Input id="contact-name" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} autoFocus /></div>
        <div className="space-y-2"><Label htmlFor="contact-type">Type</Label><Select value={draft.contactType} onValueChange={(value) => setDraft({ ...draft, contactType: value as ProfessionalContactType })}><SelectTrigger id="contact-type"><SelectValue /></SelectTrigger><SelectContent>{professionalContactTypes.map((type) => <SelectItem value={type} key={type} className="capitalize">{type}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="contact-organisation">Business or organisation</Label><Input id="contact-organisation" value={draft.organisationName ?? ''} onChange={(e) => setDraft({ ...draft, organisationName: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="contact-email">Email</Label><Input id="contact-email" type="email" value={draft.primaryEmail ?? ''} onChange={(e) => setDraft({ ...draft, primaryEmail: e.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="contact-phone">Phone</Label><Input id="contact-phone" value={draft.phone ?? ''} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="contact-notes">Notes</Label><Textarea id="contact-notes" value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Helpful private context, such as their preferred contact method." /></div>
      </div>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save contact'}</Button></div>
    </DialogContent>
  </Dialog>;
}

export default function ProfessionalContacts() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const handledOpenClientId = useRef<string | null>(null);
  const { toast } = useToast();
  const [contacts, setContacts] = useState<ProfessionalContact[]>([]);
  const [pipelineByContactId, setPipelineByContactId] = useState<Record<string, ClientPipelineState>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProfessionalContact | null>(null);
  const [selectedClient, setSelectedClient] = useState<ProfessionalContact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<ProfessionalContact | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [merging, setMerging] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const nextContacts = await listProfessionalContacts(user.id, query);
      setContacts(nextContacts);
      const documentsResult = await Promise.allSettled([
        listCommercialDocuments({ role: profile?.role === 'planner' ? 'planner' : 'vendor' }),
      ]);
      const documents = documentsResult[0].status === 'fulfilled' ? documentsResult[0].value : [];
      setPipelineByContactId(Object.fromEntries(
        nextContacts
          .filter((contact) => contact.contactType === 'client' || contact.contactType === 'couple')
          .map((contact) => [contact.id, pipelineForClient(contact, documents)]),
      ));
    }
    catch (error) { toast({ title: 'Could not load contacts', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [user?.id, profile?.role, query]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const requestedId = location.state && typeof (location.state as { openClientId?: unknown }).openClientId === 'string'
      ? (location.state as { openClientId: string }).openClientId
      : null;
    if (!requestedId || handledOpenClientId.current === requestedId) return;
    const contact = contacts.find((item) => item.id === requestedId);
    if (contact) { handledOpenClientId.current = requestedId; setSelectedClient(contact); setDialogOpen(true); }
  }, [contacts, location.state]);
  const clientContacts = useMemo(() => contacts.filter((contact) => contact.contactType === 'client' || contact.contactType === 'couple'), [contacts]);
  const recentContacts = useMemo(() => clientContacts.filter((contact) => contact.lastDocumentSentAt).slice(0, 3), [clientContacts]);
  const pipelineCounts = useMemo(() => clientContacts.reduce<Record<ClientPipelineStage, number>>((counts, contact) => {
    const stage = pipelineByContactId[contact.id]?.stage ?? 'new_enquiry';
    counts[stage] += 1;
    return counts;
  }, { new_enquiry: 0, follow_up: 0, quote_sent: 0, deposit_due: 0, booked: 0 }), [clientContacts, pipelineByContactId]);
  const documentPath = profile?.role === 'planner' ? '/planner-documents' : '/vendor-documents';
  const professionalRole: CommercialDocumentRole = profile?.role === 'planner' ? 'planner' : 'vendor';
  const saveContact = (saved: ProfessionalContact) => setContacts((current) => [saved, ...current.filter((contact) => contact.id !== saved.id)]);
  const remove = async (contact: ProfessionalContact) => {
    if (!window.confirm(`Remove ${contact.displayName} from your contacts? This will not change any documents.`)) return;
    try { await deleteProfessionalContact(contact.id); setContacts((current) => current.filter((item) => item.id !== contact.id)); toast({ title: 'Contact removed' }); }
    catch (error) { toast({ title: 'Could not remove contact', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' }); }
  };
  const merge = async () => {
    const target = contacts.find((contact) => contact.id === mergeTargetId);
    if (!mergeSource || !target) return;
    setMerging(true);
    try {
      const saved = await mergeProfessionalContacts(target, mergeSource);
      setContacts((current) => [saved, ...current.filter((contact) => contact.id !== saved.id && contact.id !== mergeSource.id)]);
      setMergeSource(null);
      setMergeTargetId('');
      toast({ title: 'Contacts merged', description: `${mergeSource.displayName} was combined into ${saved.displayName}.` });
    } catch (error) {
      toast({ title: 'Could not merge contacts', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setMerging(false); }
  };
  return <main id="main-content" className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Professional workspace</p><h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Contacts</h1><p className="mt-1 text-muted-foreground">Keep client and vendor details ready for the next document.</p></div><Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2"><Plus className="h-4 w-4" />Add contact</Button></div>
    <Card className="border-primary/15 bg-primary/[0.035]"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><BookUser className="h-5 w-5 text-primary" /><p className="text-sm text-foreground"><span className="font-medium">Save once, reuse anywhere.</span> A recipient is saved automatically after you successfully send a document.</p></div><Button asChild variant="outline" size="sm"><Link to={documentPath}>Create a document <ChevronRight className="ml-1 h-4 w-4" /></Link></Button></CardContent></Card>
    {recentContacts.length > 0 && <section><h2 className="mb-3 font-display text-xl font-semibold">Recently used</h2><div className="grid gap-px overflow-hidden border border-border/70 bg-border/70 sm:grid-cols-3">{recentContacts.map((contact) => <button key={contact.id} onClick={() => setSelectedClient(contact)} className="min-h-24 bg-background p-4 text-left transition hover:bg-muted/30"><p className="truncate font-semibold">{contact.displayName}</p><p className="mt-1 text-sm text-muted-foreground">{pipelineByContactId[contact.id]?.label ?? 'New enquiry'} · {pipelineByContactId[contact.id]?.nextAction ?? 'Start with a quote'}</p><p className="mt-3 text-sm font-medium text-primary">Open client history</p></button>)}</div></section>}
    <Card><CardHeader className="gap-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Clients</CardTitle><CardDescription>Each client has one clear place in your booking flow.</CardDescription></div><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, or business" className="w-full sm:max-w-xs" /></div>{clientContacts.length > 0 && <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/70 pt-4 text-sm sm:grid-cols-5">{([{ key: 'new_enquiry', label: 'New enquiries' }, { key: 'follow_up', label: 'Follow up' }, { key: 'quote_sent', label: 'Quote sent' }, { key: 'deposit_due', label: 'Deposit due' }, { key: 'booked', label: 'Booked' }] as const).map(({ key, label }) => <div key={key} className="flex items-baseline justify-between gap-2"><span className="text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{pipelineCounts[key]}</span></div>)}</div>}</CardHeader><CardContent>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading clients…</p> : clientContacts.length === 0 ? <div className="py-10 text-center"><BookUser className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No clients yet</p><p className="mt-1 text-sm text-muted-foreground">Send a document to save its recipient automatically, or add one now.</p></div> : <ul className="divide-y divide-border">{clientContacts.map((contact) => { const pipeline = pipelineByContactId[contact.id] ?? pipelineForClient(contact, []); return <li key={contact.id} className="py-4"><button className="w-full text-left" onClick={() => setSelectedClient(contact)}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate font-medium text-foreground">{contact.displayName}</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{pipeline.label}</p><p className="mt-1 text-sm text-muted-foreground">{pipeline.nextAction}</p><div className="mt-3 space-y-1 text-sm text-muted-foreground">{contact.primaryEmail && <p className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{contact.primaryEmail}</span></p>}{contact.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" />{contact.phone}</p>}</div></div><span className="shrink-0 text-sm font-medium text-primary">Open client</span></div></button><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => { setEditing(contact); setDialogOpen(true); }}>Edit details</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setMergeSource(contact); setMergeTargetId(''); }}>Merge duplicate</Button><Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => void remove(contact)}>Remove</Button></div></li>; })}</ul>}</CardContent></Card>
    <ContactDialog contact={editing} open={dialogOpen} onOpenChange={setDialogOpen} onSaved={saveContact} />
    <ClientWorkspaceDialog contact={selectedClient} role={professionalRole} open={Boolean(selectedClient)} onOpenChange={(open) => { if (!open) setSelectedClient(null); }} />
    <Dialog open={Boolean(mergeSource)} onOpenChange={(open) => { if (!open) setMergeSource(null); }}><DialogContent><DialogHeader><DialogTitle>Merge duplicate contact</DialogTitle><DialogDescription>Keep one contact. Its empty details will be filled from the other contact, then the duplicate will be removed.</DialogDescription></DialogHeader>{mergeSource && <div className="space-y-4"><p className="rounded-lg bg-muted/50 p-3 text-sm">Merge <span className="font-semibold">{mergeSource.displayName}</span> into:</p><Select value={mergeTargetId} onValueChange={setMergeTargetId}><SelectTrigger><SelectValue placeholder="Choose the contact to keep" /></SelectTrigger><SelectContent>{contacts.filter((contact) => contact.id !== mergeSource.id).map((contact) => <SelectItem key={contact.id} value={contact.id}>{contact.displayName}{contact.primaryEmail ? ` — ${contact.primaryEmail}` : ''}</SelectItem>)}</SelectContent></Select><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setMergeSource(null)}>Cancel</Button><Button onClick={() => void merge()} disabled={!mergeTargetId || merging}>{merging ? 'Merging…' : 'Merge contacts'}</Button></div></div>}</DialogContent></Dialog>
  </main>;
}
