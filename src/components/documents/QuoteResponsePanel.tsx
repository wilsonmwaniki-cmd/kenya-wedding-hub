import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, MessageSquareText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  getSharedQuoteResponseContext,
  respondToSharedQuote,
  type SharedCommercialDocument,
  type SharedQuoteResponseContext,
} from '@/lib/commercialDocuments';

type QuoteResponsePanelProps = {
  token: string;
  document: SharedCommercialDocument;
  onDocumentChanged: () => Promise<void> | void;
};

export default function QuoteResponsePanel({ token, document, onDocumentChanged }: QuoteResponsePanelProps) {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [context, setContext] = useState<SharedQuoteResponseContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<'accepted' | 'changes_requested' | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [suggestion, setSuggestion] = useState('');

  useEffect(() => {
    if (document.documentType !== 'quote' || authLoading) return;

    let cancelled = false;
    setLoading(true);
    getSharedQuoteResponseContext(token)
      .then((result) => {
        if (!cancelled) setContext(result);
      })
      .catch((error) => {
        console.error('Could not load quote response options:', error);
        if (!cancelled) setContext(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [authLoading, document.documentType, token, user?.id]);

  if (document.documentType !== 'quote') return null;

  const status = context?.status ?? document.status;
  const latestResponse = context?.latestResponse;

  const submitResponse = async (response: 'accepted' | 'changes_requested') => {
    try {
      setSubmitting(response);
      const saved = await respondToSharedQuote(token, {
        response,
        message: response === 'changes_requested' ? suggestion : null,
      });
      setContext((current) => current ? { ...current, status: response, latestResponse: saved } : current);
      setAcceptOpen(false);
      setChangesOpen(false);
      await onDocumentChanged();
      toast({
        title: response === 'accepted' ? 'Quote accepted' : 'Suggestions sent',
        description: response === 'accepted'
          ? 'The sender can now turn this quote into an invoice.'
          : 'The sender can amend the quote and send it back to you.',
      });
    } catch (error) {
      console.error('Could not respond to quote:', error);
      toast({
        title: 'Could not save your response',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading || authLoading) {
    return (
      <section className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-white px-5 py-4 text-sm text-muted-foreground print:hidden">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Checking response options…
      </section>
    );
  }

  if (status === 'accepted') {
    return (
      <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-emerald-950 print:hidden" aria-live="polite">
        <div className="flex gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-display text-lg font-semibold">Quote accepted</h2>
            <p className="mt-1 text-sm leading-6">
              {latestResponse?.responderName ? `${latestResponse.responderName} accepted this quote. ` : ''}
              The sender can now prepare the invoice.
            </p>
            {!user && (
              <div className="mt-4 border-t border-emerald-200 pt-4">
                <p className="text-sm">Want invoices, payments, and planning tools in one place?</p>
                <Button asChild variant="outline" className="mt-3 border-emerald-300 bg-white text-emerald-950 hover:bg-emerald-100">
                  <Link to="/auth?mode=signup&audience=couple" state={{ from: window.location.pathname }}>Create your free Zania workspace</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (status === 'changes_requested') {
    return (
      <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-amber-950 print:hidden" aria-live="polite">
        <div className="flex gap-3">
          <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="font-display text-lg font-semibold">Changes requested</h2>
            <p className="mt-1 text-sm leading-6">The sender will update this quote and send it back for approval.</p>
            {latestResponse?.message && (
              <blockquote className="mt-3 rounded-xl border border-amber-200/80 bg-white/70 px-4 py-3 text-sm leading-6">
                {latestResponse.message}
              </blockquote>
            )}
            {!user && (
              <div className="mt-4 border-t border-amber-200 pt-4">
                <p className="text-sm">Create a free Zania workspace to keep quotes, invoices, and wedding plans together.</p>
                <Button asChild variant="outline" className="mt-3 border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
                  <Link to="/auth?mode=signup&audience=couple" state={{ from: window.location.pathname }}>Explore Zania</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (status !== 'sent') return null;

  if (!context?.canRespond) {
    return (
      <section className="mt-5 rounded-2xl border border-border bg-white px-5 py-5 print:hidden">
        <h2 className="font-display text-lg font-semibold text-foreground">Response awaiting the recipient</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          The professional who sent this quote cannot approve it. The recipient can use the emailed quote link without creating an account.
        </p>
      </section>
    );
  }

  const suggestionLength = suggestion.trim().length;
  const suggestionValid = suggestionLength >= 3 && suggestionLength <= 2000;

  return (
    <>
      <section className="mt-5 rounded-2xl border border-border bg-white px-5 py-5 shadow-sm print:hidden">
        <h2 className="font-display text-xl font-semibold text-foreground">Does this quote look right?</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Accept it if you are happy, or tell the sender exactly what you would like changed. No Zania account is required.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button className="gap-2" onClick={() => setAcceptOpen(true)}>
            <CheckCircle2 className="h-4 w-4" />Accept quote
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setChangesOpen(true)}>
            <MessageSquareText className="h-4 w-4" />Request changes
          </Button>
        </div>
      </section>

      <AlertDialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This tells {document.issuerName} that you approve the price and scope shown above. They can then prepare an invoice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(submitting)}>Go back</AlertDialogCancel>
            <AlertDialogAction disabled={Boolean(submitting)} onClick={() => void submitResponse('accepted')}>
              {submitting === 'accepted' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, accept quote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What should be changed?</DialogTitle>
            <DialogDescription>
              Write a clear note for {document.issuerName}. For example: “Please remove transport and change coverage to 8 hours.”
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quote-change-suggestion">Your suggestions</Label>
            <Textarea
              id="quote-change-suggestion"
              value={suggestion}
              onChange={(event) => setSuggestion(event.target.value)}
              placeholder="Tell the sender what to add, remove, or change…"
              rows={6}
              maxLength={2000}
              autoFocus
            />
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {suggestionLength < 3 ? 'Write at least 3 characters.' : `${suggestionLength.toLocaleString()} of 2,000 characters`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesOpen(false)} disabled={Boolean(submitting)}>Cancel</Button>
            <Button disabled={!suggestionValid || Boolean(submitting)} onClick={() => void submitResponse('changes_requested')}>
              {submitting === 'changes_requested' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send suggestions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
