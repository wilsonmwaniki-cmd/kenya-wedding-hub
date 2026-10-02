import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { DeviceVerificationGate } from '@/components/DeviceVerificationGate';
import ExternalPaymentReportDialog from '@/components/documents/ExternalPaymentReportDialog';
import type { SharedCommercialDocument } from '@/lib/commercialDocuments';
import {
  buildZaniaPayIdempotencyKey,
  calculateZaniaPayCharge,
  getZaniaPayInvoiceEligibility,
  initiateZaniaPayPayment,
  isZaniaPaySessionExpired,
  ZANIA_PAY_MINIMUM_PAYMENT_KES,
  type ZaniaPayInvoiceEligibility,
} from '@/lib/zaniaPay';

type InvoicePaymentPanelProps = {
  document: SharedCommercialDocument;
  shareToken: string;
  onDocumentChanged?: () => Promise<void>;
};

function formatMoney(currency: string, amount: number) {
  return `${currency} ${Math.round(amount).toLocaleString('en-KE')}`;
}

export default function InvoicePaymentPanel({ document, shareToken, onDocumentChanged }: InvoicePaymentPanelProps) {
  const { user, loading: authLoading, signOut, deviceVerificationRequired } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [eligibility, setEligibility] = useState<ZaniaPayInvoiceEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [eligibilityRetry, setEligibilityRetry] = useState(0);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<'mpesa' | 'card' | null>(null);
  const [amount, setAmount] = useState(String(document.balanceDue));
  const [phone, setPhone] = useState('');

  const returnToInvoice = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  useEffect(() => {
    if (!user || document.documentType !== 'invoice') {
      setEligibility(null);
      setEligibilityError(null);
      return;
    }

    let cancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setEligibilityError(null);
    getZaniaPayInvoiceEligibility(document.id)
      .then((result) => {
        if (!cancelled) setEligibility(result);
      })
      .catch((error) => {
        console.error('Could not check Zania Pay eligibility:', error);
        if (!cancelled) {
          setEligibility(null);
          setEligibilityError('We are still confirming M-Pesa availability.');
          // Opening a shared invoice from an email client can beat the browser's
          // first token refresh. Retry once automatically so the payer never
          // has to discover that a page refresh is the workaround.
          if (eligibilityRetry === 0) {
            retryTimeout = setTimeout(() => {
              if (!cancelled) setEligibilityRetry(1);
            }, 500);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [document.documentType, document.id, eligibilityRetry, user]);

  const parsedAmount = Number(amount.replace(/,/g, ''));
  const amountError = useMemo(() => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return 'Enter an amount to pay.';
    if (parsedAmount < ZANIA_PAY_MINIMUM_PAYMENT_KES) {
      return `Zania Pay payments start at ${formatMoney(document.currency, ZANIA_PAY_MINIMUM_PAYMENT_KES)}.`;
    }
    if (parsedAmount > document.balanceDue) return `Enter up to ${formatMoney(document.currency, document.balanceDue)}.`;
    return null;
  }, [document.balanceDue, document.currency, parsedAmount]);
  const mpesaCharge = useMemo(
    () => calculateZaniaPayCharge(parsedAmount, 'mpesa'),
    [parsedAmount],
  );

  if (document.documentType !== 'invoice' || document.status === 'paid' || document.status === 'void') {
    return null;
  }

  const recordExternalButton = (
    <ExternalPaymentReportDialog document={document} shareToken={shareToken} onChanged={onDocumentChanged} />
  );

  if (authLoading) return null;

  if (!user) {
    return (
      <section className="mt-6 border border-[#ded7cf] bg-white px-5 py-5 print:hidden sm:px-7">
        <h2 className="text-xl font-semibold text-[#251f1b]">Pay this invoice</h2>
        <p className="mt-2 text-sm text-[#746a62]">Sign in to check M-Pesa payment availability. No paid couple subscription is required.</p>
        <Button asChild className="mt-4">
          <Link to="/sign-in" state={{ from: returnToInvoice }}>Sign in to continue</Link>
        </Button>
      </section>
    );
  }

  // Shared invoices are public routes, so they do not pass through the normal
  // workspace guard. Surface the same device-confirmation step here before a
  // money movement can begin, rather than misleading the payer with a session
  // expiry loop.
  if (deviceVerificationRequired) {
    return (
      <section className="mt-6 border border-[#ded7cf] bg-white px-5 py-5 print:hidden sm:px-7">
        <DeviceVerificationGate inline />
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mt-6 border border-[#ded7cf] bg-white px-5 py-5 text-sm text-[#746a62] print:hidden sm:px-7">
        <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Checking Zania Pay options…</p>
        <div className="mt-4">{recordExternalButton}</div>
      </section>
    );
  }

  if (!eligibility) {
    return (
      <section className="mt-6 border border-[#ded7cf] bg-white px-5 py-5 print:hidden sm:px-7">
        <h2 className="text-xl font-semibold text-[#251f1b]">Payment options</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#746a62]">{eligibilityError ?? 'We are confirming M-Pesa availability.'}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => setEligibilityRetry((current) => current + 1)}>
          Try again
        </Button>
        <div className="mt-4">{recordExternalButton}</div>
      </section>
    );
  }

  if (eligibility.state === 'not_connected' || eligibility.state === 'invoice_unavailable') {
    return (
      <section className="mt-6 border border-[#ded7cf] bg-white px-5 py-5 print:hidden sm:px-7">
        <h2 className="text-xl font-semibold text-[#251f1b]">Payment options</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#746a62]">Already paid the professional directly by M-Pesa, bank, card or cash? Report it here for confirmation.</p>
        <div className="mt-4">{recordExternalButton}</div>
      </section>
    );
  }

  if (!eligibility.allowed) {
    return (
      <section className="mt-6 border border-[#ded7cf] bg-white px-5 py-5 print:hidden sm:px-7">
        <h2 className="text-xl font-semibold text-[#251f1b]">Pay this invoice</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#746a62]">{eligibility.state === 'couple_upgrade' ? 'Payment availability is being updated. No paid couple subscription is required; please reload shortly.' : eligibility.reason}</p>
        <div className="mt-4">{recordExternalButton}</div>
      </section>
    );
  }

  const startPayment = async (paymentMethod: 'mpesa' | 'card') => {
    if (amountError) {
      toast({ title: 'Check the amount', description: amountError, variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'mpesa' && phone.replace(/\D/g, '').length < 9) {
      toast({ title: 'Enter your M-Pesa number', description: 'Use the phone number that should receive the payment prompt.', variant: 'destructive' });
      return;
    }

    setSubmitting(paymentMethod);
    try {
      const result = await initiateZaniaPayPayment({
        invoiceId: document.id,
        amount: parsedAmount,
        paymentMethod,
        phone: paymentMethod === 'mpesa' ? phone : undefined,
        idempotencyKey: buildZaniaPayIdempotencyKey(document.id),
      });
      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }
      toast({ title: 'Payment started', description: result.message });
    } catch (error) {
      if (isZaniaPaySessionExpired(error)) {
        if (deviceVerificationRequired) return;
        // The expired token may still be reflected in client state. Clear only
        // this browser's session, then send the payer straight to sign-in with
        // a safe return path to this exact invoice.
        await signOut();
        navigate('/sign-in', { state: { from: returnToInvoice }, replace: true });
        return;
      }
      toast({
        title: 'Could not start payment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <section className="mt-6 border border-[#ded7cf] bg-white px-5 py-5 print:hidden sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#251f1b]">Pay this invoice</h2>
          <p className="mt-1 text-sm text-[#746a62]">The professional receives the full invoice payment.</p>
        </div>
        <p className="text-sm font-semibold text-[#251f1b]">Balance {formatMoney(document.currency, document.balanceDue)}</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="zania-pay-amount">Amount to pay</Label>
          <Input
            id="zania-pay-amount"
            className="mt-2"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))}
          />
          {amountError ? <p className="mt-1 text-xs text-red-600">{amountError}</p> : null}
        </div>
        <div>
          <Label htmlFor="zania-pay-phone">M-Pesa number</Label>
          <Input
            id="zania-pay-phone"
            className="mt-2"
            inputMode="tel"
            placeholder="e.g. 0712 345 678"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      </div>

      {!amountError ? (
        <dl className="mt-5 max-w-md space-y-2 border-y border-[#e7e0d9] py-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[#746a62]">Invoice payment</dt>
            <dd className="font-medium text-[#251f1b]">{formatMoney(document.currency, mpesaCharge.invoicePayment)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#746a62]">M-Pesa processing fee</dt>
            <dd className="font-medium text-[#251f1b]">{formatMoney(document.currency, mpesaCharge.processingFee)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#746a62]">Zania service fee</dt>
            <dd className="font-medium text-[#251f1b]">{formatMoney(document.currency, mpesaCharge.serviceFee)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-[#e7e0d9] pt-2">
            <dt className="font-semibold text-[#251f1b]">Paystack checkout total</dt>
            <dd className="font-semibold text-[#251f1b]">{formatMoney(document.currency, mpesaCharge.totalCharged)}</dd>
          </div>
          <div className="border-t border-[#e7e0d9] pt-3">
            <dt className="sr-only">Mobile network fee notice</dt>
            <dd className="text-xs leading-5 text-[#81766d]">Your mobile network may add its own transaction fee. That network fee is set by your provider and is not included above.</dd>
          </div>
        </dl>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={() => void startPayment('mpesa')} disabled={submitting !== null}>
          {submitting === 'mpesa' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Pay with M-Pesa
        </Button>
        <Button variant="outline" disabled title="Card payments will open after automatic fee passing is enabled.">
          Card coming soon
        </Button>
        {recordExternalButton}
      </div>
      <p className="mt-4 text-xs text-[#81766d]">You pay the Paystack processing fee and the disclosed KES 50 Zania service fee. Your mobile network may charge an additional fee. The professional receives the full invoice payment.</p>
    </section>
  );
}
