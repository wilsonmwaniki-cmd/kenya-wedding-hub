import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PublicLinkLoading, PublicLinkUnavailable } from '@/components/PublicLinkState';
import {
  getVendorEnquiryResponseContext,
  respondToVendorEnquiry,
  vendorEnquiryResponseLabel,
  type VendorEnquiryResponseChoice,
  type VendorEnquiryResponseContext,
} from '@/lib/vendorEnquiryResponses';

const choices: Array<{ value: VendorEnquiryResponseChoice; label: string; detail: string }> = [
  { value: 'available', label: 'Available', detail: 'I am available and may include an indicative amount.' },
  { value: 'unavailable', label: 'Unavailable', detail: 'I cannot take this wedding or event.' },
  { value: 'needs_details', label: 'Need more details', detail: 'I need more information before confirming availability.' },
];

export default function VendorEnquiryResponse() {
  const { token = '' } = useParams();
  const [context, setContext] = useState<VendorEnquiryResponseContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [choice, setChoice] = useState<VendorEnquiryResponseChoice>('available');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getVendorEnquiryResponseContext(token)
      .then((data) => { if (active) setContext(data); })
      .catch(() => { if (active) setContext(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const submit = async () => {
    setError(null);
    if (choice === 'needs_details' && message.trim().length < 3) {
      setError('Tell the sender what information you need.');
      return;
    }
    const quoteAmount = amount.trim() ? Number(amount) : null;
    if (quoteAmount != null && (!Number.isFinite(quoteAmount) || quoteAmount < 0)) {
      setError('Enter a valid indicative amount.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await respondToVendorEnquiry({
        token, response: choice, message, quoteAmount, quoteCurrency: 'KES', quoteValidUntil: validUntil || null,
      });
      setContext((current) => current ? { ...current, canRespond: false, latestResponse: response } : current);
    } catch (submitError: any) {
      setError(submitError?.message || 'Your response could not be recorded. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PublicLinkLoading loadingLabel="Opening enquiry…" />;
  if (!context?.available) return <PublicLinkUnavailable title="Enquiry unavailable" message="This response link is invalid, expired, or the enquiry was not delivered." />;

  const latest = context.latestResponse;
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Zania vendor enquiry</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">{context.subject}</h1>
          <p className="mt-2 text-sm text-muted-foreground">From {context.senderName} to {context.recipientName}</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Enquiry details</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{context.message}</p></CardContent>
        </Card>

        {!context.canRespond && latest ? (
          <Card className="border-emerald-200 bg-emerald-50/70">
            <CardContent className="flex gap-3 pt-6">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="font-semibold text-emerald-950">Response recorded</p>
                <p className="mt-1 text-sm text-emerald-900">{vendorEnquiryResponseLabel(latest.response)}</p>
                {latest.message ? <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">{latest.message}</p> : null}
                {latest.quoteAmount != null ? <p className="mt-2 text-sm font-medium text-emerald-950">Indicative amount: {latest.quoteCurrency ?? 'KES'} {Number(latest.quoteAmount).toLocaleString()}</p> : null}
                <p className="mt-3 text-xs text-emerald-800">This response does not create a booking or formal quote.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><MessageSquareText className="h-5 w-5 text-primary" />Respond</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {choices.map((item) => (
                  <button key={item.value} type="button" onClick={() => setChoice(item.value)} className={`rounded-xl border p-3 text-left transition ${choice === item.value ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border bg-background hover:border-primary/40'}`}>
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-response-message">Message {choice === 'needs_details' ? '(required)' : '(optional)'}</Label>
                <Textarea id="vendor-response-message" value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} rows={5} placeholder="Add context for the couple or planner…" />
              </div>
              {choice === 'available' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vendor-response-amount">Indicative amount in KES (optional)</Label>
                    <Input id="vendor-response-amount" type="number" min="0" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="150000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendor-response-valid">Amount valid until (optional)</Label>
                    <Input id="vendor-response-valid" type="date" min={new Date().toISOString().slice(0, 10)} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
                  </div>
                </div>
              ) : null}
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <Button onClick={() => void submit()} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Send response
              </Button>
              <p className="text-xs text-muted-foreground">An indicative amount is not a formal quote, contract, or booking. The sender must take a separate confirmed action.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
