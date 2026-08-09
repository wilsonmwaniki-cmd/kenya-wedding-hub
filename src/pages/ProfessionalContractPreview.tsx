import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getProfessionalContract,
  getProfessionalContractActivity,
  listVendorListingOptions,
  professionalContractStatusLabel,
  type ProfessionalContractActivity,
  type ProfessionalContractRecord,
  type VendorListingOption,
} from '@/lib/commercialDocuments';

function dateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-GB').format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export default function ProfessionalContractPreview() {
  const { contractId = '' } = useParams();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ProfessionalContractRecord | null>(null);
  const [activity, setActivity] = useState<ProfessionalContractActivity | null>(null);
  const [vendorListing, setVendorListing] = useState<VendorListingOption | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const nextContract = await getProfessionalContract(contractId);
        if (cancelled) return;
        setContract(nextContract);
        if (!nextContract) return;
        const [nextActivity, listings] = await Promise.all([
          getProfessionalContractActivity(nextContract.id),
          nextContract.role === 'vendor' ? listVendorListingOptions() : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setActivity(nextActivity);
        setVendorListing(listings.find((listing) => listing.id === nextContract.vendorListingId) ?? null);
      } catch (error) {
        console.error('Could not load contract preview:', error);
        toast({ title: 'Could not open contract preview', description: 'Please try again in a moment.', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [contractId, toast]);

  const issuerSigner = useMemo(() => activity?.signers.find((item) => item.signerRole === 'issuer') ?? null, [activity]);
  const clientSigner = useMemo(() => activity?.signers.find((item) => item.signerRole === 'client') ?? null, [activity]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const backPath = contract?.role === 'planner' ? '/planner-documents/contracts' : '/vendor-documents/contracts';
  if (!contract) {
    return <div className="flex min-h-screen items-center justify-center bg-background px-6"><div className="border border-border bg-card p-8 text-center"><h1 className="font-display text-2xl">Contract not found</h1><Button asChild className="mt-5"><Link to={backPath}>Back to contracts</Link></Button></div></div>;
  }

  const issuerName = contract.role === 'planner'
    ? profile?.company_name || profile?.full_name || 'Zania planner workspace'
    : vendorListing?.label || profile?.company_name || profile?.full_name || 'Zania vendor workspace';
  const issuerEmail = contract.role === 'planner' ? profile?.company_email || user?.email : vendorListing?.email || profile?.company_email || user?.email;
  const issuerPhone = contract.role === 'planner' ? profile?.company_phone : vendorListing?.phone || profile?.company_phone;

  return (
    <main className="min-h-screen bg-[#eee9e1] px-4 py-6 text-foreground sm:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-5 flex items-center justify-between print:hidden">
          <Button asChild variant="ghost" className="gap-2"><Link to={backPath}><ArrowLeft className="h-4 w-4" />Back to contracts</Link></Button>
          <Button className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Print or save PDF</Button>
        </div>

        <article className="min-h-[1120px] overflow-hidden bg-[#fffdf9] shadow-[0_24px_70px_rgba(48,38,31,0.18)] print:min-h-0 print:shadow-none">
          <header className="bg-primary px-8 py-10 text-primary-foreground sm:px-12">
            <div className="grid gap-9 sm:grid-cols-[1.15fr_0.85fr]">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">Service agreement</p><h1 className="mt-3 font-display text-4xl font-semibold">{contract.title}</h1><p className="mt-2 text-sm text-primary-foreground/75">Prepared by {issuerName}</p></div>
              <div className="text-sm leading-6 text-primary-foreground/82 sm:text-right"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">Contact</p>{issuerPhone && <p>{issuerPhone}</p>}{issuerEmail && <p>{issuerEmail}</p>}</div>
            </div>
            <div className="mt-10 grid gap-7 border-t border-primary-foreground/20 pt-7 sm:grid-cols-[1.15fr_0.85fr]">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/68">Agreement with</p><p className="mt-2 text-lg font-semibold">{contract.recipientName}</p>{contract.weddingName && <p className="text-sm text-primary-foreground/78">{contract.weddingName}</p>}{contract.recipientEmail && <p className="text-sm text-primary-foreground/78">{contract.recipientEmail}</p>}{contract.recipientPhone && <p className="text-sm text-primary-foreground/78">{contract.recipientPhone}</p>}</div>
              <div className="grid grid-cols-2 gap-6 sm:text-right"><div><p className="text-[11px] uppercase tracking-[0.16em] text-primary-foreground/68">Agreement date</p><p className="mt-2 font-semibold">{dateLabel(contract.createdAt)}</p></div><div><p className="text-[11px] uppercase tracking-[0.16em] text-primary-foreground/68">Event date</p><p className="mt-2 font-semibold">{dateLabel(contract.eventDate)}</p></div></div>
            </div>
          </header>

          <div className="space-y-10 px-8 py-10 sm:px-12">
            <section><h2 className="font-display text-2xl">What we are agreeing to</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{contract.summary || 'No service summary has been added yet.'}</p></section>
            <section className="border-t border-border pt-9"><h2 className="font-display text-2xl">Agreement details</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{contract.terms || 'No agreement details have been added yet.'}</p></section>
            <section className="border-t border-border pt-9">
              <div className="grid gap-8 sm:grid-cols-2">
                {[{ label: contract.role === 'planner' ? 'Planner' : 'Vendor', signer: issuerSigner, fallback: issuerName }, { label: 'Client', signer: clientSigner, fallback: contract.recipientName }].map(({ label, signer, fallback }) => (
                  <div key={label} className="min-h-28 border-b border-border pb-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p><p className="mt-8 font-display text-2xl italic">{signer?.signedName || 'Signature pending'}</p><p className="mt-2 text-sm">{signer?.signerName || fallback}</p>{signer?.signedAt && <p className="text-xs text-muted-foreground">Signed {dateLabel(signer.signedAt)}</p>}</div>
                ))}
              </div>
            </section>
            <p className="border-t border-border pt-5 text-xs text-muted-foreground">Agreement stage: {professionalContractStatusLabel(contract.status)}</p>
          </div>
        </article>
      </div>
    </main>
  );
}
