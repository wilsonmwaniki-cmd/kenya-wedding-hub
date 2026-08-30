import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  PenLine,
  Phone,
  Printer,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function safeDateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
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
  const [signerEmail, setSignerEmail] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await getSharedProfessionalContract(token);
        if (!cancelled) {
          setDocument(data);
          setSignerEmail(data?.recipientEmail ?? '');
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
        signerEmail,
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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="ghost" className="gap-2">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
              Back to Zania
            </Link>
          </Button>
          <Button className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print contract
          </Button>
        </div>

        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(230,118,73,0.12),rgba(255,255,255,0.98)_38%,rgba(255,243,237,0.9))] shadow-card print:shadow-none">
          <CardContent className="p-6 sm:p-8">
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
                  Shared contract
                </p>
                <CardTitle className="font-display text-3xl text-foreground">{document.title}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
                  {professionalContractStatusLabel(document.status)}
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={document.status === 'completed' ? 'success' : 'warning'}>
                  {professionalContractStatusLabel(document.status)}
                </Badge>
                {document.eventDate && <Badge variant="secondary">Event {safeDateLabel(document.eventDate)}</Badge>}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Issued by</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{document.issuerName}</p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {document.issuerEmail && issuerEmailHref && (
                      <a className="flex items-center gap-2 hover:text-foreground" href={issuerEmailHref}>
                        <Mail className="h-4 w-4 text-primary" />
                        {document.issuerEmail}
                      </a>
                    )}
                    {document.issuerPhone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        {document.issuerPhone}
                      </p>
                    )}
                    {document.issuerWebsite && issuerWebsiteHref && (
                      <a className="flex items-center gap-2 hover:text-foreground" href={issuerWebsiteHref} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4 text-primary" />
                        {displaySafeUrl(document.issuerWebsite)}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {document.issuerLocation && <p>{document.issuerLocation}</p>}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/80 bg-white/80 p-5 shadow-sm md:text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Prepared for</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">{document.recipientName}</p>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {document.recipientEmail && <p>{document.recipientEmail}</p>}
                    {document.recipientPhone && <p>{document.recipientPhone}</p>}
                    {document.weddingName && <p>{document.weddingName}</p>}
                  </div>
                </div>
              </div>

              {document.summary && (
                <div className="rounded-2xl border border-border/70 bg-white/80 p-5 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Summary</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">{document.summary}</p>
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Contract terms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-border bg-white/90 p-5">
              <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">
                {document.terms || 'No contract terms have been added yet.'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="sign-contract" className="border-primary/20 shadow-card">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{canSign ? 'Sign contract' : 'Contract signed'}</CardTitle>
            {canSign && <CardDescription>Type your name after reading the terms above.</CardDescription>}
          </CardHeader>
          <CardContent>
            {canSign ? (
              <div className="mx-auto max-w-xl space-y-4">
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
                  <Label htmlFor="signer-email">Email (optional)</Label>
                  <Input
                    id="signer-email"
                    type="email"
                    value={signerEmail}
                    onChange={(event) => setSignerEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
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
              <div role="status" className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-900">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  Signature saved
                </div>
                <p className="mt-2">
                  {clientSigner?.signedName || document.recipientName} signed on {safeDateLabel(clientSigner?.signedAt)}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}
