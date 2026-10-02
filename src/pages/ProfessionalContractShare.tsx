import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  Loader2,
  PenLine,
  Printer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  getSharedProfessionalContract,
  professionalContractEventLabel,
  professionalContractStatusLabel,
  signSharedProfessionalContract,
  type ProfessionalContractEventRecord,
  type ProfessionalContractSignerRecord,
  type SharedProfessionalContract,
} from '@/lib/commercialDocuments';
import { displaySafeUrl, normalizeEmailHref, normalizeExternalUrl } from '@/lib/security';
import { PublicLinkLoading, PublicLinkUnavailable } from '@/components/PublicLinkState';
import ContractTermsContent from '@/components/documents/ContractTermsContent';
import DocumentBackLink from '@/components/documents/DocumentBackLink';
import { contractPrintTitle } from '@/lib/documentPrintTitle';
import { printDocumentElement } from '@/lib/printDocument';

function safeDateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function money(currency: string, amount: number) {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

function signatureFontStyle() {
  return {
    fontFamily: '"Montserrat", sans-serif',
    fontStyle: 'italic',
    fontWeight: 600,
  } as const;
}

function eventDescription(event: ProfessionalContractEventRecord) {
  if (event.actorName) return event.actorName;
  if (event.eventType === 'sent_for_signature') return 'Ready for client review';
  if (event.eventType === 'share_link_created') return 'Public contract link prepared';
  if (event.eventType === 'share_viewed') return 'Recipient opened the contract';
  if (event.eventType === 'completed') return 'Both sides have signed';
  return 'Zania contract workflow';
}

function signerCardTitle(signer: ProfessionalContractSignerRecord) {
  if (signer.signerRole === 'issuer') return signer.signerTitle || 'Issuer';
  return signer.signerTitle || 'Client';
}

export default function ProfessionalContractShare() {
  const { token = '' } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [document, setDocument] = useState<SharedProfessionalContract | null>(null);
  const [signedName, setSignedName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getSharedProfessionalContract(token);
        if (!cancelled) {
          setDocument(data);
        }
      } catch (error) {
        console.error('Could not load shared professional contract:', error);
        if (!cancelled) setDocument(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!document) return;
    const previousTitle = window.document.title;
    window.document.title = contractPrintTitle(document.title);
    return () => { window.document.title = previousTitle; };
  }, [document]);

  const clientSigner = useMemo(
    () => document?.signers.find((signer) => signer.signerRole === 'client') ?? null,
    [document],
  );
  const issuerSigner = useMemo(
    () => document?.signers.find((signer) => signer.signerRole === 'issuer') ?? null,
    [document],
  );
  const issuerEmailHref = normalizeEmailHref(document?.issuerEmail);
  const issuerWebsiteHref = normalizeExternalUrl(document?.issuerWebsite);
  const canSign = !!document && !clientSigner?.signedAt;

  const handleSign = async () => {
    if (!document) return;
    if (!signedName.trim()) {
      setFormError('Enter your full name.');
      return;
    }
    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setFormError('Enter the 6-digit code from your email.');
      return;
    }
    if (!agreedToTerms) {
      setFormError('Confirm that you agree to the contract.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const next = await signSharedProfessionalContract({
        shareToken: token,
        signedName,
        verificationCode: verificationCode.trim(),
        agreedToTerms,
        signerUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        signerTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        signerLocale: typeof navigator !== 'undefined' ? navigator.language : null,
      });
      setDocument(next);
      toast({
        title: 'Contract signed',
        description: 'Your signature has been saved.',
      });
    } catch (error) {
      console.error('Could not sign contract:', error);
      setFormError(error instanceof Error ? error.message : 'Try again.');
      toast({
        title: 'Could not sign contract',
        description: 'Check the form and try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PublicLinkLoading loadingLabel="Opening contract…" />;
  }

  if (!document) {
    return <PublicLinkUnavailable title="Contract unavailable" />;
  }
  const printTitle = contractPrintTitle(document.title);

  return (
    <div className="min-h-screen bg-[#eee9e1] px-4 py-6 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[900px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <DocumentBackLink />
          <Button className="gap-2" onClick={() => printDocumentElement('contract-document-print', printTitle)}>
            <Printer className="h-4 w-4" />
            Print contract
          </Button>
        </div>

        <article id="contract-document-print" className="overflow-hidden bg-[#fffdf9] shadow-[0_24px_70px_rgba(48,38,31,0.16)] print:shadow-none">
          <header className="bg-primary px-8 py-10 text-primary-foreground sm:px-12">
            <div className="grid gap-9 sm:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">Service agreement</p>
                <h1 className="mt-3 font-display text-4xl font-semibold">{document.title}</h1>
                <p className="mt-2 text-sm text-primary-foreground/75">{professionalContractStatusLabel(document.status)}</p>
              </div>
              <div className="text-sm leading-6 text-primary-foreground/82 sm:text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">Issued by</p>
                <p className="mt-2 font-semibold text-primary-foreground">{document.issuerName}</p>
                {document.issuerEmail && issuerEmailHref && <a className="block hover:underline" href={issuerEmailHref}>{document.issuerEmail}</a>}
                {document.issuerPhone && <p>{document.issuerPhone}</p>}
                {document.issuerWebsite && issuerWebsiteHref && <a className="block hover:underline" href={issuerWebsiteHref} target="_blank" rel="noopener noreferrer">{displaySafeUrl(document.issuerWebsite)}</a>}
                {document.issuerLocation && <p>{document.issuerLocation}</p>}
              </div>
            </div>
            <div className="mt-10 grid gap-7 border-t border-primary-foreground/20 pt-7 sm:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/68">Agreement with</p>
                <p className="mt-2 text-lg font-semibold">{document.recipientName}</p>
                {document.weddingName && <p className="text-sm text-primary-foreground/78">{document.weddingName}</p>}
                {document.recipientEmail && <p className="text-sm text-primary-foreground/78">{document.recipientEmail}</p>}
                {document.recipientPhone && <p className="text-sm text-primary-foreground/78">{document.recipientPhone}</p>}
              </div>
              <div className="sm:text-right">
                <p className="text-[11px] uppercase tracking-[0.16em] text-primary-foreground/68">Event date</p>
                <p className="mt-2 font-semibold">{safeDateLabel(document.eventDate)}</p>
              </div>
            </div>
          </header>

          <div className="space-y-10 px-8 py-10 sm:px-12">
            {document.totalAmount != null || document.paymentSchedule.length ? (
              <section>
                <h2 className="font-display text-2xl">Financial terms</h2>
                {document.totalAmount != null ? <p className="mt-3 text-lg font-semibold">Total: {money(document.currency, document.totalAmount)}</p> : null}
                {document.depositAmount != null ? <p className="mt-1 text-sm">Deposit: {money(document.currency, document.depositAmount)}</p> : null}
                {document.paymentSchedule.length ? (
                  <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
                    {document.paymentSchedule.map((payment, index) => (
                      <li key={`${payment.title}-${payment.dueDate}-${index}`} className="flex flex-wrap justify-between gap-3 py-3">
                        <span>{payment.title} · due {safeDateLabel(payment.dueDate)}</span>
                        <strong>{money(document.currency, payment.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
            <section>
              <h2 className="font-display text-2xl">Agreement details</h2>
              <div className="mt-4 text-sm leading-7 text-foreground">
                <ContractTermsContent terms={document.terms} />
              </div>
            </section>

            <section id="sign-contract" className="border-t border-border pt-9 print:hidden">
              <div className="mx-auto max-w-xl">
                <h2 className="font-display text-2xl">{canSign ? 'Sign contract' : 'Contract signed'}</h2>
                {canSign && <p className="mt-2 text-sm text-muted-foreground">Type your name after reading the agreement.</p>}
              </div>
            {canSign ? (
              <div className="mx-auto mt-6 max-w-xl space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signed-name">Full name *</Label>
                  <Input
                    id="signed-name"
                    value={signedName}
                    onChange={(event) => {
                      setSignedName(event.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder={document.recipientName}
                    aria-invalid={Boolean(formError && !signedName.trim())}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Email code *</Label>
                  <Input
                    id="verification-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(event) => {
                      setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                      if (formError) setFormError(null);
                    }}
                    placeholder="6-digit code"
                  />
                  <p className="text-xs text-muted-foreground">Use the code in the email that brought you here. No Zania account is needed.</p>
                </div>
                <label className="flex items-start gap-3 border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                  <Checkbox
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => {
                      setAgreedToTerms(checked === true);
                      if (formError) setFormError(null);
                    }}
                  />
                  <span>I have read and agree to this contract. My typed name is my signature.</span>
                </label>
                {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
                <Button className="w-full gap-2" onClick={handleSign} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                  {submitting ? 'Signing…' : 'Sign contract'}
                </Button>
                {document.shareExpiresAt && (
                  <p className="text-center text-xs text-muted-foreground">Link expires {safeDateLabel(document.shareExpiresAt)}.</p>
                )}
              </div>
            ) : (
              <div role="status" className="mx-auto mt-6 max-w-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Signature saved
                </div>
                <p className="mt-2">
                  {clientSigner?.signedName || document.recipientName} signed on {safeDateLabel(clientSigner?.signedAt)}.
                </p>
              </div>
            )}
            </section>
          </div>
        </article>

        <details className="rounded-3xl border border-border/70 bg-card shadow-card">
          <summary className="cursor-pointer list-none px-6 py-4 text-sm font-semibold text-foreground marker:content-none">View signatures and history</summary>
        <div className="grid gap-6 border-t border-border/70 p-4 xl:grid-cols-[1.05fr_0.95fr] sm:p-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Signatures</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {[issuerSigner, clientSigner].map((signer, index) => (
                <div key={signer?.id ?? index} className="rounded-2xl border border-border bg-white/90 p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {signer ? signerCardTitle(signer) : index === 0 ? 'Issuer' : 'Client'}
                  </p>
                  {signer?.signedName ? (
                    <>
                      <p className="mt-4 text-3xl text-foreground" style={signatureFontStyle()}>
                        {signer.signedName}
                      </p>
                      <p className="mt-3 text-sm font-medium text-foreground">{signer.signerName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Signed on {safeDateLabel(signer.signedAt)}</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-4 text-sm font-medium text-foreground">
                        {index === 0 ? document.issuerName : document.recipientName}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">Signature still pending.</p>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {document.events.length ? (
                  document.events.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex w-5 flex-col items-center">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${index === 0 ? 'bg-primary' : 'bg-primary/45'}`} />
                        {index !== document.events.length - 1 && <span className="mt-1 h-full w-px bg-border" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-semibold text-foreground">{professionalContractEventLabel(event.eventType)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{eventDescription(event)}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString('en-KE', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-6 text-sm text-muted-foreground">
                    No activity yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        </details>
        <p className="pb-4 text-center text-xs text-muted-foreground">
          Sent securely through <Link className="font-medium text-foreground hover:underline" to="/">Zania</Link>
          {document.documentHash ? ` · Document ${document.documentHash.slice(0, 12)}` : ''}
        </p>
      </div>
    </div>
  );
}
