import { Link } from 'react-router-dom';
import { ArrowRight, FileText, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useProfessionalEntitlements } from '@/hooks/useProfessionalEntitlements';
import { buildPricingHref, type ProfessionalAudience, type ProfessionalEntitlementKey } from '@/lib/pricingPlans';

interface ProfessionalFeatureGateProps {
  audience?: ProfessionalAudience;
  feature: ProfessionalEntitlementKey;
  children: React.ReactNode;
}

export default function ProfessionalFeatureGate({
  audience,
  feature,
  children,
}: ProfessionalFeatureGateProps) {
  const { profile, isSuperAdmin, rolePreview } = useAuth();
  const resolvedAudience = audience
    ?? (profile?.role === 'planner' ? 'planner' : profile?.role === 'vendor' ? 'vendor' : null);
  const { entitlements, loading } = useProfessionalEntitlements(resolvedAudience);
  const previewAccess = isSuperAdmin && rolePreview === resolvedAudience;

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center px-6">
        <div className="rounded-2xl border border-border/70 bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
          Checking your Professional plan...
        </div>
      </div>
    );
  }

  if (!resolvedAudience) return null;
  if (entitlements[feature] || previewAccess) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-3xl items-center px-4 py-12 sm:px-6">
      <section className="w-full overflow-hidden rounded-[2rem] border border-primary/20 bg-[linear-gradient(145deg,rgba(230,118,73,0.09),rgba(255,255,255,0.98)_42%,rgba(248,241,235,0.9))] p-6 shadow-card sm:p-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Professional plan</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Create client documents with Professional
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          Upgrade to make quotes, invoices, receipts, contracts, and reusable templates.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {['Send clear quotes', 'Track money due', 'Keep receipts together'].map((label) => (
            <div key={label} className="flex min-h-14 items-center gap-3 rounded-2xl border border-border/70 bg-white/75 px-4 py-3 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {label}
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="min-h-12 gap-2">
            <Link to={buildPricingHref(resolvedAudience, `${resolvedAudience}.invoicing`)}>
              See Professional plan
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-h-12">
            <Link to={resolvedAudience === 'vendor' ? '/vendor-dashboard' : '/clients'}>Back to dashboard</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
