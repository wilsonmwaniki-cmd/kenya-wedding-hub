import { ArrowRight, CheckCircle2, Clock3, FileCheck2, Inbox, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { CommercialDocumentRecord } from '@/lib/commercialDocuments';
import type { DocumentRequestRecord } from '@/lib/documentRequests';

type DocumentActionOverviewProps = {
  requests: DocumentRequestRecord[];
  documents: CommercialDocumentRecord[];
  loading?: boolean;
  onOpenRequest: (request: DocumentRequestRecord) => void;
  onOpenDocument: (documentId: string) => void;
};

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short' }).format(new Date(value));
}

export default function DocumentActionOverview({
  requests,
  documents,
  loading = false,
  onOpenRequest,
  onOpenDocument,
}: DocumentActionOverviewProps) {
  const needsAction = requests.filter((request) =>
    ['new', 'viewed', 'changes_requested'].includes(request.status),
  );
  const waitingDocuments = documents.filter((document) =>
    document.status === 'sent' || document.status === 'part_paid',
  );
  const completedDocuments = documents.filter((document) =>
    ['accepted', 'paid', 'issued'].includes(document.status),
  );

  return (
    <section className="space-y-4" aria-labelledby="document-action-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Document desk</p>
          <h2 id="document-action-heading" className="mt-1 font-display text-2xl font-semibold text-foreground">
            What needs attention?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Start with the first card. Everything else can wait.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={needsAction.length > 0 ? 'destructive' : 'secondary'}>{needsAction.length} need you</Badge>
          <Badge variant="warning">{waitingDocuments.length} waiting</Badge>
          <Badge variant="success">{completedDocuments.length} filed</Badge>
        </div>
      </div>

      {loading ? (
        <Card className="border-border/70 shadow-card">
          <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
            Opening your document desk...
          </CardContent>
        </Card>
      ) : needsAction.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {needsAction.slice(0, 4).map((request, index) => (
            <Card
              key={request.id}
              className={`overflow-hidden shadow-card ${
                index === 0
                  ? 'border-[#ef9f8b] bg-[linear-gradient(135deg,#fff4ef,#fffaf7)]'
                  : 'border-[#efd8a4] bg-[#fffaf0]'
              }`}
            >
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className={`mt-0.5 rounded-full p-2 ${index === 0 ? 'bg-[#f8d9ce] text-[#a6422d]' : 'bg-[#f4e6bd] text-[#755517]'}`}>
                      {request.status === 'changes_requested' ? <PencilLine className="h-4 w-4" /> : <Inbox className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {request.status === 'changes_requested' ? 'Changes requested' : 'New quote request'}
                      </p>
                      <h3 className="mt-1 break-words text-lg font-semibold text-foreground">{request.requesterName}</h3>
                    </div>
                  </div>
                  {request.dueAt ? <Badge variant="outline">By {formatDate(request.dueAt)}</Badge> : null}
                </div>

                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">{request.serviceCategory || request.title}</p>
                  <p className="text-muted-foreground">
                    {request.weddingName || 'Wedding request'}
                    {request.eventDate ? ` · ${formatDate(request.eventDate)}` : ''}
                  </p>
                  {request.message ? <p className="line-clamp-2 pt-1 text-muted-foreground">{request.message}</p> : null}
                </div>

                <Button className="mt-auto w-full justify-between gap-2" onClick={() => onOpenRequest(request)}>
                  {request.status === 'changes_requested' ? 'Amend quote' : 'Review quote'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-[#b9dec7] bg-[#f1fbf4] shadow-card">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="rounded-full bg-[#d9f2e1] p-2 text-[#247b47]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Nothing is waiting on you</h3>
              <p className="text-sm text-muted-foreground">New quote and contract requests will appear here first.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {(waitingDocuments.length > 0 || completedDocuments.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="border-[#c8d8eb] bg-[#f3f7fc] shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-[#315f92]">
                <Clock3 className="h-4 w-4" />
                <h3 className="font-semibold">Waiting for client</h3>
                <Badge variant="outline" className="ml-auto">{waitingDocuments.length}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {waitingDocuments.slice(0, 3).map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => onOpenDocument(document.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#dbe6f2] bg-white/80 px-3 py-2 text-left"
                  >
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {document.recipientName} · {document.documentNumber}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                {waitingDocuments.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is waiting.</p> : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-muted/10 shadow-none">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileCheck2 className="h-4 w-4" />
                <h3 className="font-semibold text-foreground">Completed and filed</h3>
                <Badge variant="outline" className="ml-auto">{completedDocuments.length}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Accepted quotes, paid invoices, and issued receipts stay safely filed in the library below.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
