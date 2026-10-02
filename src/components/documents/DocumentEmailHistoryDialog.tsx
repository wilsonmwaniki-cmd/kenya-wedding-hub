import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  listCommercialDocumentEmailEvents,
  type CommercialDocumentEmailEvent,
} from '@/lib/commercialDocuments';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  documentLabel: string;
  focusedEmailEventId?: string | null;
};

export default function DocumentEmailHistoryDialog({ open, onOpenChange, documentId, documentLabel, focusedEmailEventId }: Props) {
  const [events, setEvents] = useState<CommercialDocumentEmailEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void listCommercialDocumentEmailEvents(documentId)
      .then((nextEvents) => {
        if (!cancelled) setEvents(nextEvents);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load email history.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, open]);

  useEffect(() => {
    if (!open || !focusedEmailEventId || loading) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`email-event-${focusedEmailEventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusedEmailEventId, loading, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Email history</DialogTitle>
          <p className="text-sm text-muted-foreground">{documentLabel}</p>
        </DialogHeader>
        <div className="min-h-28 py-2">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
              Loading email history…
            </div>
          ) : error ? (
            <p className="border-l-2 border-destructive pl-3 text-sm text-destructive">{error}</p>
          ) : events.length === 0 ? (
            <div className="border-y border-border/70 py-6">
              <p className="font-medium text-foreground">No emails sent yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Use Share → Email to send this document.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/70 border-y border-border/70">
              {events.map((event) => (
                <div key={event.id} id={`email-event-${event.id}`} className={focusedEmailEventId === event.id ? 'bg-primary/[0.06] px-3 py-4' : 'py-4'}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{event.subject}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">Sent to {event.recipientEmail}</p>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.sentAt}>
                      {new Date(event.sentAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
