import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listReceivedDocuments, receivedDocumentPath } from '@/lib/receivedDocuments';
import { useDocumentOrganiser } from '@/hooks/useDocumentOrganiser';
import PaidDocumentOrganiser from '@/components/documents/PaidDocumentOrganiser';
import ExternalContractIngestionPanel from '@/components/documents/ExternalContractIngestionPanel';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';

export default function ReceivedDocuments() {
  const { user } = useAuth();
  const organiser = useDocumentOrganiser();
  const wedding = useWeddingEntitlements();
  const [search, setSearch] = useState('');
  const { data = [], isPending, isError, refetch } = useQuery({
    queryKey: ['received-documents', user?.id],
    queryFn: listReceivedDocuments,
    enabled: Boolean(user),
  });
  const filtered = data.filter((document) =>
    `${document.title} ${document.document_number ?? ''} ${document.document_type}`
      .toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-4 sm:space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Received documents</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:mt-2">Quotes, invoices, receipts and contracts shared with your account. No subscription is needed to view them.</p>
        <p className="mt-1 break-all text-xs text-muted-foreground sm:mt-2 sm:text-sm">Sent to: {user?.email}</p>
      </header>
      {organiser.data?.enabled ? <PaidDocumentOrganiser data={organiser.data} />
        : organiser.isError ? <div role="alert" className="rounded-2xl border p-5"><p>The organiser is temporarily unavailable. Your documents below are still accessible.</p><Button variant="outline" className="mt-3" onClick={() => void organiser.refetch()}>Retry organiser</Button></div>
          : !organiser.pending ? <section className="rounded-2xl border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold sm:text-xl">Connect your wedding paperwork</h2><p className="mt-1 text-xs leading-5 text-muted-foreground sm:mt-2 sm:text-sm">Upgrade to Collaborative for vendor files, linked document history, quote comparison, a payment calendar and missing-document checks. Your received documents and invoice payment access remain free.</p><Button asChild size="sm" className="mt-3 sm:mt-4"><Link to="/pricing?audience=couple">Explore Collaborative</Link></Button></section> : null}
      {wedding.weddingId ? <ExternalContractIngestionPanel weddingId={wedding.weddingId} enabled={Boolean(organiser.data?.enabled)} /> : null}
      <Input aria-label="Search received documents" placeholder="Search title, number or document type" value={search} onChange={(event) => setSearch(event.target.value)} />
      {isPending ? <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading documents…</p>
        : isError ? <div role="alert"><p>Could not load your documents.</p><Button variant="outline" className="mt-3" onClick={() => void refetch()}>Try again</Button></div>
          : filtered.length === 0 ? <div className="rounded-2xl border bg-card p-6">
            <FileText className="mb-3 h-6 w-6 text-muted-foreground" />
            <h2 className="font-semibold">{search ? 'No matching documents' : 'No shared documents yet'}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Ask the sender to use your account email and share the document. Verify your email if needed. Drafts and expired or revoked links are not shown here.</p>
          </div> : <ul className="space-y-2 sm:space-y-3">
            {filtered.map((document) => <li key={`${document.document_type}-${document.id}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-card p-3 sm:rounded-2xl sm:p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{document.document_type} · {document.status.replace(/_/g, ' ')}</p>
                <h2 className="mt-0.5 line-clamp-1 break-words text-sm font-semibold sm:mt-1 sm:text-base">{document.title}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">{document.document_number}</p>
                {document.total_amount !== null && document.currency ? <p className="mt-1 text-sm font-medium sm:mt-2 sm:text-base">{document.currency} {Number(document.total_amount).toLocaleString('en-KE')}</p> : null}
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0"><Link to={receivedDocumentPath(document)} state={{ documentReturnTo: '/received-documents' }} aria-label={`Open ${document.title}`}>Open</Link></Button>
            </li>)}
          </ul>}
    </div>
  );
}
