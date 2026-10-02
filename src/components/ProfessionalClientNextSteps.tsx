import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { listCommercialDocuments, type CommercialDocumentRecord, type CommercialDocumentRole } from '@/lib/commercialDocuments';
import { listProfessionalContacts, type ProfessionalContact } from '@/lib/professionalContacts';

type Stage = 'new_enquiry' | 'follow_up' | 'quote_sent' | 'deposit_due' | 'booked';

function matches(contact: ProfessionalContact, document: CommercialDocumentRecord) {
  const emails = [contact.primaryEmail, ...contact.additionalEmails]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());
  return Boolean(document.recipientEmail && emails.includes(document.recipientEmail.trim().toLowerCase()))
    || (emails.length === 0 && document.recipientName.trim().toLowerCase() === contact.displayName.trim().toLowerCase());
}

function clientStage(contact: ProfessionalContact, allDocuments: CommercialDocumentRecord[]) {
  const records = allDocuments.filter((document) => matches(contact, document));
  const quotes = records.filter((document) => document.documentType === 'quote');
  const invoices = records.filter((document) => document.documentType === 'invoice');
  const changedQuote = quotes.find((document) => document.status === 'changes_requested');
  const unpaidInvoice = invoices.find((document) => document.balanceDue > 0 && document.status !== 'draft');
  const paidInvoice = invoices.find((document) => document.amountPaid > 0 || document.status === 'paid');
  const sentQuote = quotes.find((document) => document.status === 'sent');

  if (!records.length) return { stage: 'new_enquiry' as Stage, label: 'Start with a quote', document: null };
  if (changedQuote) return { stage: 'follow_up' as Stage, label: 'Review quote changes', document: changedQuote };
  if (unpaidInvoice) return { stage: 'deposit_due' as Stage, label: 'Follow up on payment', document: unpaidInvoice };
  if (paidInvoice) return { stage: 'booked' as Stage, label: 'Prepare the next client step', document: paidInvoice };
  if (sentQuote) return { stage: 'quote_sent' as Stage, label: 'Wait for a reply', document: sentQuote };
  return { stage: 'follow_up' as Stage, label: 'Choose the next action', document: records[0] ?? null };
}

const priority: Record<Stage, number> = { deposit_due: 0, follow_up: 1, quote_sent: 2, new_enquiry: 3, booked: 4 };

export default function ProfessionalClientNextSteps({ role }: { role: CommercialDocumentRole }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ProfessionalContact[]>([]);
  const [documents, setDocuments] = useState<CommercialDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void Promise.all([listProfessionalContacts(user.id), listCommercialDocuments({ role })])
      .then(([nextContacts, nextDocuments]) => {
        if (!cancelled) { setContacts(nextContacts); setDocuments(nextDocuments); }
      })
      .catch((error) => console.error('Could not load client next steps:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [role, user?.id]);

  const actions = useMemo(() => contacts
    .filter((contact) => contact.contactType === 'client' || contact.contactType === 'couple')
    .map((contact) => ({ contact, ...clientStage(contact, documents) }))
    .sort((a, b) => priority[a.stage] - priority[b.stage])
    .slice(0, 3), [contacts, documents]);
  const documentPath = role === 'planner' ? '/planner-documents' : '/vendor-documents';

  if (loading) return <section className="border-y border-border/70 px-4 py-5 text-sm text-muted-foreground sm:px-6"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Checking client next steps…</section>;
  if (!actions.length) return null;

  return <section className="border-y border-border/70" aria-labelledby="client-next-steps-title">
    <div className="px-4 py-5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Client follow-up</p>
      <h2 id="client-next-steps-title" className="mt-2 font-display text-xl font-semibold text-foreground">Keep these client steps moving</h2>
      <p className="mt-1 text-sm text-muted-foreground">The few conversations most likely to move work forward.</p>
    </div>
    <div className="divide-y divide-border/70 border-t border-border/70">
      {actions.map(({ contact, stage, label, document }) => {
        const to = document ? documentPath : '/contacts';
        const state = document ? { openDocumentId: document.id, focus: stage === 'deposit_due' ? 'payment' : undefined } : { openClientId: contact.id };
        return <Link key={contact.id} to={to} state={state} className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6">
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-foreground">{contact.displayName}</span><span className="mt-0.5 block truncate text-sm text-muted-foreground">{label}</span></span>
          <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-primary">Open <ArrowRight className="h-4 w-4" /></span>
        </Link>;
      })}
    </div>
  </section>;
}
