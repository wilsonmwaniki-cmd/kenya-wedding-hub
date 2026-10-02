import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { documentAlerts, dueInvoices, groupVendorDocuments, invoiceBalances, type DocumentOrganiserData, type OrganisedDocument } from '@/lib/documentOrganiser';
import { receivedDocumentPath } from '@/lib/receivedDocuments';

function money(currency: string | null, amount: number | null) { return `${currency ?? ''} ${Number(amount ?? 0).toLocaleString('en-KE')}`; }
function DocumentLink({ document }: { document: OrganisedDocument }) {
  return <Link className="font-medium text-primary underline underline-offset-4" to={receivedDocumentPath(document)} state={{ documentReturnTo: '/received-documents' }}>{document.document_number ?? document.title}</Link>;
}

export default function PaidDocumentOrganiser({ data }: { data: DocumentOrganiserData }) {
  const [tab, setTab] = useState<'vendors' | 'calendar' | 'compare' | 'alerts'>('vendors');
  const [selected, setSelected] = useState<string[]>([]);
  const documents = data.documents;
  const groups = groupVendorDocuments(documents);
  const alerts = documentAlerts(documents);
  const quotes = documents.filter((d) => d.document_type === 'quote' && !['void', 'declined'].includes(d.status));
  const compared = quotes.filter((d) => selected.includes(d.id));
  return <section className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:space-y-5 sm:p-6">
    <header><p className="text-[0.65rem] uppercase tracking-widest text-primary sm:text-xs">Collaborative · Document organiser</p><h2 className="mt-1 text-xl font-semibold sm:mt-2 sm:text-2xl">Your wedding paperwork, connected</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm">Organised from documents shared with this account. Amounts and links come from the sender’s records.</p></header>
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Document organiser views">
      {(['vendors','calendar','compare','alerts'] as const).map((value) => <Button key={value} size="sm" variant={tab === value ? 'default' : 'outline'} aria-pressed={tab === value} onClick={() => setTab(value)}>{({ vendors: 'Vendor files', calendar: 'Payment calendar', compare: 'Compare quotes', alerts: `Checks (${alerts.length})` })[value]}</Button>)}
    </div>
    {tab === 'vendors' ? <div className="space-y-4">{groups.length === 0 ? <p>No shared vendor documents yet.</p> : groups.map((group) => <details key={group.id} className="rounded-xl border p-4" open={groups.length === 1}>
      <summary className="cursor-pointer break-words font-semibold">{group.name} <span className="font-normal text-muted-foreground">· {group.documents.length} documents</span></summary>
      <div className="mt-4 space-y-4">
        {invoiceBalances(group.documents).map((balance) => <p key={balance.currency} className="text-sm">Recorded paid: {money(balance.currency,balance.paid)} · Outstanding: {money(balance.currency,balance.due)}</p>)}
        {group.documents.map((d) => {
          const parent = group.documents.find((p) => p.id === d.source_id);
          const history = data.events.filter((e) => e.document_id === d.id);
          return <article key={d.id} className="border-t pt-3">
            <p className="text-xs uppercase text-muted-foreground">{d.document_type} · {d.status.replace(/_/g,' ')}</p>
            <h3 className="mt-1 break-words font-medium">{d.title}</h3><DocumentLink document={d} />
            {d.total_amount !== null ? <p className="mt-1 text-sm">{money(d.currency,d.total_amount)}</p> : null}
            {parent ? <p className="mt-1 text-sm">Linked to <DocumentLink document={parent} /></p> : null}
            {history.length ? <details className="mt-2 text-sm"><summary className="cursor-pointer">Change history ({history.length})</summary><ul className="mt-2 space-y-1">{history.map((e) => <li key={e.id}>{new Date(e.occurred_at).toLocaleString('en-KE')} · {e.previous_status && e.previous_status !== e.status ? `${e.previous_status.replace(/_/g,' ')} → ` : ''}{e.status.replace(/_/g,' ')}{e.previous_status === e.status ? ' · details updated' : ''}</li>)}</ul></details> : <p className="mt-2 text-xs text-muted-foreground">Future document changes will appear here.</p>}
          </article>;
        })}
      </div>
    </details>)}</div> : null}
    {tab === 'calendar' ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Invoice balances by due date—not inferred instalment dates. Confirm any separate payment schedule with your vendor.</p>{dueInvoices(documents).length === 0 ? <p>No outstanding shared invoices.</p> : dueInvoices(documents).map((d) => <div key={d.id} className="flex flex-wrap justify-between gap-3 rounded-xl border p-4"><div><p className="font-semibold">{d.due_date ?? 'Due date not set'}</p><p className="text-sm">{d.professional_name}</p><DocumentLink document={d} /></div><p>{money(d.currency,d.balance_due)}</p></div>)}</div> : null}
    {tab === 'alerts' ? <div className="space-y-3"><p className="text-sm text-muted-foreground">Checks use shared records only. A missing document may exist elsewhere; this is not proof of a payment or contract problem.</p>{alerts.length === 0 ? <p>No missing-document or amount checks flagged.</p> : alerts.map((alert,i) => <div key={`${alert.document.id}-${i}`} className="rounded-xl border p-4"><p>{alert.message}</p><p className="mt-2 text-sm">{alert.document.professional_name} · <DocumentLink document={alert.document} /></p></div>)}</div> : null}
    {tab === 'compare' ? <div className="space-y-4"><p className="text-sm text-muted-foreground">Select up to three quotes for the same service. Compare scope as well as price; currencies are shown separately.</p><div className="space-y-2">{quotes.map((q) => <label key={q.id} className="flex items-start gap-3 rounded-xl border p-3"><input className="mt-1" type="checkbox" checked={selected.includes(q.id)} disabled={!selected.includes(q.id) && selected.length >= 3} onChange={(e) => setSelected((current) => e.target.checked ? [...current,q.id] : current.filter((id) => id !== q.id))} /><span className="min-w-0 break-words">{q.professional_name} · {q.title} · {money(q.currency,q.total_amount)}</span></label>)}</div>{quotes.length === 0 ? <p>No shared quotes to compare yet.</p> : null}<div className="grid gap-3 lg:grid-cols-3">{compared.map((q) => <article key={q.id} className="min-w-0 rounded-xl border p-4"><h3 className="break-words font-semibold">{q.professional_name}</h3><DocumentLink document={q} /><p className="mt-2 font-semibold">{money(q.currency,q.total_amount)}</p><p className="text-xs uppercase">{q.status.replace(/_/g,' ')}</p><ul className="mt-3 space-y-2 text-sm">{q.items.map((item,i) => <li key={i} className="break-words border-t pt-2">{item.description}<p className="text-muted-foreground">{item.quantity} × {money(q.currency,item.unit_price)} = {money(q.currency,item.line_total)}</p></li>)}</ul><p className="mt-3 text-xs text-muted-foreground">Open the full quote to review terms, discounts and taxes.</p></article>)}</div></div> : null}
  </section>;
}
