import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  formatLeadBudgetRange,
  getLeadContact,
  getLeadMatch,
  listLeadBriefs,
  listLeadMessages,
  listLeadOffers,
  revealLeadContact,
  sendLeadMessage,
  submitLeadOffer,
  updateLeadMatchStatus,
  type LeadBrief,
  type LeadMatch,
  type LeadMessage,
  type LeadOffer,
} from '@/lib/leadMarketplace';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Please try again.';
}

export default function LeadConversation() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [match, setMatch] = useState<LeadMatch | null>(null);
  const [brief, setBrief] = useState<LeadBrief | null>(null);
  const [messages, setMessages] = useState<LeadMessage[]>([]);
  const [offers, setOffers] = useState<LeadOffer[]>([]);
  const [contact, setContact] = useState<{ couple_name: string | null; couple_email: string | null; couple_phone: string | null } | null>(null);
  const [message, setMessage] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerSummary, setOfferSummary] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!matchId) return;
    try {
      const nextMatch = await getLeadMatch(matchId);
      const [briefRows, messageRows, offerRows, revealedContact] = await Promise.all([
        listLeadBriefs([nextMatch.lead_request_id]),
        listLeadMessages(matchId),
        listLeadOffers(matchId),
        getLeadContact(matchId),
      ]);
      setMatch(nextMatch);
      setBrief(briefRows[0] ?? null);
      setMessages(messageRows);
      setOffers(offerRows);
      setContact(revealedContact);
    } catch (error: unknown) {
      toast({ title: 'Could not open this conversation', description: errorMessage(error), variant: 'destructive' });
      navigate('/dashboard');
    }
  }, [matchId, navigate, toast]);

  useEffect(() => { void load(); }, [load]);

  if (!match || !user) return <div className="p-6 text-sm text-muted-foreground">Opening conversation…</div>;
  const isProvider = match.provider_user_id === user.id;
  const senderSide = isProvider ? 'provider' : 'couple';

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!matchId || !message.trim()) return;
    setBusy(true);
    try {
      await sendLeadMessage(matchId, senderSide, message);
      setMessage('');
      await load();
    } catch (error: unknown) {
      toast({ title: 'Message not sent', description: errorMessage(error), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const sendOffer = async (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(offerAmount.replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount < 0 || !offerSummary.trim()) return;
    setBusy(true);
    try {
      await submitLeadOffer(match.id, amount, offerSummary);
      setOfferAmount('');
      setOfferSummary('');
      await load();
    } catch (error: unknown) {
      toast({ title: 'Offer not sent', description: errorMessage(error), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const chooseProvider = async () => {
    setBusy(true);
    try {
      await updateLeadMatchStatus(match.id, 'selected');
      toast({ title: `${match.provider_name} selected`, description: 'You can now choose whether to share your contact details.' });
      await load();
    } catch (error: unknown) {
      toast({ title: 'Could not select this provider', description: errorMessage(error), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const shareContact = async () => {
    setBusy(true);
    try {
      await revealLeadContact(match.id);
      toast({ title: 'Contact details shared' });
      await load();
    } catch (error: unknown) {
      toast({ title: 'Contact details not shared', description: errorMessage(error), variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const backPath = isProvider ? (match.provider_type === 'vendor' ? '/vendor-dashboard' : '/clients') : '/vendors';

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-28 lg:pb-0">
      <Link to={backPath} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground"><ArrowLeft className="h-4 w-4" />Back</Link>
      <header className="border-b border-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Private Zania conversation</p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-foreground">{isProvider ? 'Anonymous couple' : match.provider_name}</h1>
        <p className="mt-1 text-muted-foreground">{match.provider_category}</p>
      </header>

      <section className="grid gap-3 border border-border bg-card p-5 sm:grid-cols-3">
        <p className="flex items-center gap-2 text-sm"><CalendarDays className="h-4 w-4 text-primary" />{brief?.wedding_date ? new Date(`${brief.wedding_date}T00:00:00`).toLocaleDateString('en-GB') : 'Date unavailable'}</p>
        <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-primary" />{[brief?.location_town, brief?.location_county].filter(Boolean).join(', ') || 'Location not set'}</p>
        <p className="text-sm font-medium">{formatLeadBudgetRange(brief)}</p>
      </section>

      {contact && (
        <section className="border border-primary/30 bg-primary/5 p-5">
          <h2 className="font-display text-lg font-semibold">Contact details shared</h2>
          <p className="mt-2 text-sm">{contact.couple_name || 'Couple'}</p>
          {contact.couple_email && <p className="text-sm">{contact.couple_email}</p>}
          {contact.couple_phone && <p className="text-sm">{contact.couple_phone}</p>}
        </section>
      )}

      {offers.length > 0 && (
        <section className="border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Offers</h2>
          <div className="mt-3 divide-y divide-border">
            {offers.map((offer) => <div key={offer.id} className="py-3"><p className="font-semibold">KES {Number(offer.amount_kes).toLocaleString()}</p><p className="mt-1 text-sm text-muted-foreground">{offer.summary}</p></div>)}
          </div>
        </section>
      )}

      <section className="border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Messages</h2>
        <div className="mt-4 space-y-3" aria-live="polite">
          {messages.length === 0 && <p className="text-sm text-muted-foreground">Ask a question to begin.</p>}
          {messages.map((item) => (
            <div key={item.id} className={`max-w-[85%] border p-3 text-sm ${item.sender_side === senderSide ? 'ml-auto border-primary/30 bg-primary/5' : 'border-border bg-background'}`}>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="mt-4 space-y-2">
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message" maxLength={1000} />
          <p className="text-xs text-muted-foreground">Contact details remain hidden unless the couple chooses to share them.</p>
          <Button type="submit" disabled={busy || !message.trim()}>Send message</Button>
        </form>
      </section>

      {isProvider && ['accepted', 'selected'].includes(match.status) && (
        <form onSubmit={sendOffer} className="border border-border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Send an offer</h2>
          <div className="mt-4 space-y-3">
            <Input aria-label="Offer amount in KES" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} inputMode="numeric" placeholder="Amount in KES" />
            <Textarea value={offerSummary} onChange={(event) => setOfferSummary(event.target.value)} placeholder="What is included?" maxLength={1000} />
            <Button type="submit" disabled={busy}>Send offer</Button>
          </div>
        </form>
      )}

      {!isProvider && match.status === 'accepted' && <Button className="w-full" onClick={chooseProvider} disabled={busy}>Choose {match.provider_name}</Button>}
      {!isProvider && match.status === 'selected' && !contact && <Button className="w-full" onClick={shareContact} disabled={busy}>Share my contact details</Button>}
    </div>
  );
}
