import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown, Loader2, Plus } from 'lucide-react';
import { AnimatedCardDetails } from '@/components/AnimatedCardDetails';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  connectZaniaPayAccount, listZaniaPayAccounts, loadZaniaPayDestinations,
  refreshZaniaPayAccountStatus, setDefaultZaniaPayAccount,
  type ZaniaPayAccountStatus, type ZaniaPayDestination,
} from '@/lib/zaniaPay';

type Props = { audience: 'vendor' | 'planner'; canAcceptPayments: boolean; vendorListingId?: string | null };

export default function ZaniaPaySetupCard({ audience, canAcceptPayments, vendorListingId }: Props) {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<ZaniaPayAccountStatus[]>([]);
  const [destinations, setDestinations] = useState<ZaniaPayDestination[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== 'undefined' && window.location.hash === '#zania-pay');
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [defaultingId, setDefaultingId] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState<{ title: string; description: string } | null>(null);

  const reloadAccounts = async () => setAccounts(await listZaniaPayAccounts());

  useEffect(() => {
    let cancelled = false;
    listZaniaPayAccounts()
      .then((result) => { if (!cancelled) setAccounts(result); })
      .catch((error) => console.error('Could not load Zania Pay accounts:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const openFromPaymentLink = () => {
      if (window.location.hash !== '#zania-pay') return;
      setPanelOpen(true);
      window.requestAnimationFrame(() => document.getElementById('zania-pay')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    openFromPaymentLink();
    window.addEventListener('hashchange', openFromPaymentLink);
    return () => window.removeEventListener('hashchange', openFromPaymentLink);
  }, []);

  const selectedDestination = useMemo(() => destinations.find((item) => item.code === bankCode) ?? null, [bankCode, destinations]);
  const isMobileMoney = selectedDestination?.type.toLowerCase().includes('mobile');
  const verifiedAccounts = accounts.filter((account) => account.status === 'verified');
  const defaultAccount = verifiedAccounts.find((account) => account.isDefault) ?? verifiedAccounts[0] ?? null;

  const openSetup = async () => {
    setSetupNotice(null);
    if (audience === 'vendor' && !vendorListingId) {
      toast({ title: 'Finish your vendor listing first', description: 'Add your business details before connecting payouts.', variant: 'destructive' });
      return;
    }
    setLoadingDestinations(true);
    try {
      const result = await loadZaniaPayDestinations({ audience, vendorListingId });
      if (!result.length) throw new Error('No Kenyan payout destinations are available right now.');
      setDestinations(result);
      setFormOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again later.';
      if (message === 'Payout setup is not open yet.' || message === 'Payout setup is still being tested.') {
        setSetupNotice({
          title: 'Zania Pay is not available to this business yet',
          description: 'Payout setup is being released in stages. Your plan is unchanged; when your business is invited, the connection step will appear here.',
        });
      } else {
        toast({ title: 'Payout setup is unavailable', description: message, variant: 'destructive' });
      }
    } finally { setLoadingDestinations(false); }
  };

  const connectAccount = async () => {
    if (!bankCode) return void toast({ title: 'Choose where to receive money', variant: 'destructive' });
    if (!/^\d{6,20}$/.test(accountNumber.replace(/\D/g, ''))) return void toast({ title: `Enter a valid ${isMobileMoney ? 'M-Pesa' : 'account'} number`, variant: 'destructive' });
    if (!termsAccepted) return void toast({ title: 'Confirm the payout account', variant: 'destructive' });
    setSubmitting(true);
    try {
      const result = await connectZaniaPayAccount({ audience, vendorListingId, bankCode, accountNumber, termsAccepted });
      await reloadAccounts();
      setFormOpen(false); setBankCode(''); setAccountNumber(''); setTermsAccepted(false);
      toast({ title: result.status === 'verified' ? 'Payout account connected' : 'Payout account awaiting verification', description: result.status === 'verified' ? 'It is now available for invoices.' : 'Paystack must verify it before it can receive payments.' });
    } catch (error) {
      toast({ title: 'Could not connect payout account', description: error instanceof Error ? error.message : 'Check the details and try again.', variant: 'destructive' });
    } finally { setSubmitting(false); }
  };

  const checkStatus = async (accountId: string) => {
    setCheckingId(accountId);
    try {
      const result = await refreshZaniaPayAccountStatus({ audience, vendorListingId, accountId });
      await reloadAccounts();
      toast({ title: result[0]?.status === 'verified' ? 'Payout account verified' : 'Verification still pending' });
    } catch (error) {
      toast({ title: 'Could not check the account', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setCheckingId(null); }
  };

  const makeDefault = async (accountId: string) => {
    setDefaultingId(accountId);
    try {
      await setDefaultZaniaPayAccount(accountId); await reloadAccounts();
      toast({ title: 'Default payout account updated', description: 'New invoices will use this destination unless you choose another.' });
    } catch (error) {
      toast({ title: 'Could not change the default', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setDefaultingId(null); }
  };

  if (loading) return null;
  if (!canAcceptPayments) return <section id="zania-pay" className="scroll-mt-6 rounded-2xl border border-border/70 bg-card px-5 py-5 shadow-card sm:px-6"><h2 className="font-display text-lg text-foreground">Zania Pay</h2><p className="mt-1 text-sm text-muted-foreground">Receive invoice payments in one place. Payment setup is available with Professional access; once it is active, you can connect where you want to receive money here.</p><Button asChild className="mt-4"><Link to={`/pricing?audience=${audience}`}>Check payment access</Link></Button></section>;

  return <section id="zania-pay" className="scroll-mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5 sm:py-3.5"
        aria-expanded={panelOpen}
        aria-controls="zania-pay-account-details"
        onClick={() => setPanelOpen((current) => !current)}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          {verifiedAccounts.length ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /> : null}
          <h2 className="font-display text-base font-semibold text-foreground sm:text-lg">{verifiedAccounts.length ? 'Zania Pay' : 'Receive invoice payments'}</h2>
          {defaultAccount ? <span className="truncate text-sm text-muted-foreground">Default: {defaultAccount.settlementDestinationHint || 'verified account'}</span> : <span className="text-sm text-muted-foreground">No payout account connected</span>}
          {verifiedAccounts.length > 0 ? <span className="rounded-full bg-[hsl(var(--success-soft))] px-2 py-0.5 text-xs font-medium text-success">{verifiedAccounts.length} verified</span> : null}
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${panelOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      <AnimatedCardDetails open={panelOpen}>
        <div id="zania-pay-account-details" className="border-t border-border/70 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">{verifiedAccounts.length ? 'Choose the default destination for new invoices, or add another verified payout account.' : 'Connect the account where you want to receive invoice payments. Zania Pay access is introduced in stages, and your next step will always appear here.'}</p>
          <Button size="sm" variant={verifiedAccounts.length ? 'outline' : 'default'} onClick={() => formOpen ? setFormOpen(false) : void openSetup()} disabled={loadingDestinations}>{loadingDestinations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : verifiedAccounts.length ? <Plus className="mr-2 h-4 w-4" /> : null}{formOpen ? 'Close setup' : verifiedAccounts.length ? 'Add account' : 'Connect account'}</Button>
        </div>

        {setupNotice ? <div role="status" className="mt-3 border-l-2 border-primary/60 bg-primary/5 px-3 py-2.5 text-sm"><p className="font-medium text-foreground">{setupNotice.title}</p><p className="mt-1 leading-5 text-muted-foreground">{setupNotice.description}</p></div> : null}

        {accounts.length > 0 ? <div className="mt-3 divide-y divide-border/70 border-y border-border/70">{accounts.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{account.settlementDestinationHint || 'Payout account'}</p><p className="mt-0.5 text-xs text-muted-foreground">{account.isDefault ? 'Default · ' : ''}{account.status === 'verified' ? 'Verified' : account.status === 'pending' ? 'Verification pending' : account.status}</p>{account.rejectionReason ? <p className="mt-1 text-xs text-destructive">{account.rejectionReason}</p> : null}</div><div className="flex gap-2">{account.status === 'pending' && account.id ? <Button size="sm" variant="outline" onClick={() => void checkStatus(account.id!)} disabled={checkingId === account.id}>{checkingId === account.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Refresh</Button> : null}{account.status === 'verified' && !account.isDefault && account.id ? <Button size="sm" variant="outline" onClick={() => void makeDefault(account.id!)} disabled={defaultingId === account.id}>{defaultingId === account.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Make default</Button> : null}</div></div>)}</div> : null}

        <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${formOpen ? 'mt-4 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} aria-hidden={!formOpen}><div className="overflow-hidden"><div className="max-w-xl space-y-4 border-t border-border/70 pt-4">
          <div className="space-y-2"><Label htmlFor="zania-pay-destination">Where should we send your money?</Label><Select value={bankCode} onValueChange={setBankCode}><SelectTrigger id="zania-pay-destination"><SelectValue placeholder="Choose bank or M-Pesa" /></SelectTrigger><SelectContent>{destinations.map((destination) => <SelectItem key={`${destination.code}-${destination.type}`} value={destination.code}>{destination.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="zania-pay-account-number">{isMobileMoney ? 'M-Pesa number' : 'Account number'}</Label><Input id="zania-pay-account-number" inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, '').slice(0, 20))} placeholder={isMobileMoney ? '07•• ••• •••' : 'Enter account number'} /><p className="text-xs text-muted-foreground">Zania keeps only the last four digits after setup.</p></div>
          <div className="flex items-start gap-3"><Checkbox id="zania-pay-account-confirmation" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} /><Label htmlFor="zania-pay-account-confirmation" className="text-sm font-normal leading-5">I confirm this payout account belongs to me or my business and accept the <Link to="/terms" className="underline underline-offset-2">Zania Pay terms</Link>.</Label></div>
          <Button onClick={() => void connectAccount()} disabled={submitting}>{submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Connect account</Button>
        </div></div></div>
        </div>
      </AnimatedCardDetails>
  </section>;
}
