import { useMemo, useState } from 'react';
import { Gift, HeartHandshake, Loader2, ShoppingBag, Sparkles } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { getEntitlementDecision } from '@/lib/entitlements';
import { getCoupleAddonDefinition } from '@/lib/pricingPlans';
import { startStripeCheckout } from '@/lib/billing';
import { useToast } from '@/hooks/use-toast';

const registryHighlights = [
  'One wishlist for the whole wedding.',
  'Purchased gifts get marked off automatically.',
  'Guests get a clear link instead of WhatsApp back-and-forth.',
];

export default function GiftRegistry() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { profile, isSuperAdmin, rolePreview } = useAuth();
  const { weddingId, entitlements, couplePlanTier, loading } = useWeddingEntitlements();
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const decision = getEntitlementDecision('couple.gift_registry', {
    profile,
    bypass: isSuperAdmin && rolePreview === 'couple',
    weddingEntitlements: entitlements,
    couplePlanTier,
  });

  const canAccessRegistry = decision.allowed && Boolean(weddingId);
  const addon = getCoupleAddonDefinition('gift_registry_addon');
  const isFocusedUpgradeFlow = searchParams.get('intent') === 'upgrade';
  const upgradeState = searchParams.get('upgrade');

  const statusMessage = useMemo(() => {
    if (upgradeState === 'success') {
      return {
        title: 'Gift Registry unlocked',
        body: 'This wedding now has registry access. You can stay here as we build the actual wishlist and guest purchase flow.',
        tone: 'success',
      } as const;
    }

    if (upgradeState === 'cancelled') {
      return {
        title: 'Checkout cancelled',
        body: 'No problem. Your registry add-on was not purchased yet, and you can come back to it anytime.',
        tone: 'warning',
      } as const;
    }

    return null;
  }, [upgradeState]);

  const handleCheckout = async () => {
    if (!profile) return;

    if (profile.role !== 'couple' && !(isSuperAdmin && rolePreview === 'couple')) {
      toast({
        title: 'Couple owners purchase wedding add-ons',
        description: 'Open this page as the couple workspace owner to add Gift Registry to the wedding.',
        variant: 'destructive',
      });
      return;
    }

    if (!weddingId) {
      toast({
        title: 'Create or join a wedding first',
        description: 'Gift Registry attaches to a specific wedding workspace.',
        variant: 'destructive',
      });
      return;
    }

    if (!addon.stripeMonthlyLookupKey) {
      toast({
        title: 'Checkout is not configured',
        description: 'This add-on does not have a Stripe price configured yet.',
        variant: 'destructive',
      });
      return;
    }

    setCheckoutLoading(true);
    try {
      await startStripeCheckout({
        audience: 'couple',
        feature: 'gift_registry',
        lookupKey: addon.stripeMonthlyLookupKey,
        cadence: 'monthly',
        weddingId,
        successPath: '/gift-registry?upgrade=success',
        cancelPath: '/gift-registry?intent=upgrade&upgrade=cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem creating your Stripe checkout session.',
        variant: 'destructive',
      });
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <Badge variant="secondary">Add-on</Badge>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Gift Registry</h1>
          <p className="max-w-2xl text-muted-foreground">
            Give guests one simple place to see what the couple wants and what has already been bought.
          </p>
        </div>
      </div>

      {statusMessage && (
        <Card className={`border ${statusMessage.tone === 'success' ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
          <CardContent className="px-6 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Registry status</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">{statusMessage.title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{statusMessage.body}</p>
          </CardContent>
        </Card>
      )}

      {!canAccessRegistry && !loading && !isFocusedUpgradeFlow && (
        <InlineUpgradePrompt decision={decision} />
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-primary/10 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <ShoppingBag className="h-5 w-5 text-primary" />
              {canAccessRegistry ? 'Registry access is active' : 'Add Gift Registry to this wedding'}
            </CardTitle>
            <CardDescription>
              {canAccessRegistry
                ? 'The add-on is active. We can now build the actual wishlist and guest checkout flow on top of this.'
                : 'This add-on unlocks a dedicated registry space for gifts, tracking, and guest sharing.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-5">
              <p className="text-sm font-medium text-foreground">What this add-on gives you</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {registryHighlights.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {!canAccessRegistry ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button className="gap-2" onClick={() => void handleCheckout()} disabled={checkoutLoading}>
                  {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Add Gift Registry to this wedding
                </Button>
                <Button asChild variant="outline">
                  <Link to="/pricing?audience=couple">See all wedding pricing</Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">You’re in the right place now</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      We’ve kept this page intentionally simple. The next build can focus on the actual gift list, categories, and guest purchase experience.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <HeartHandshake className="h-5 w-5 text-primary" />
              Keep it simple
            </CardTitle>
            <CardDescription>
              We’ve removed the long product explanation here. This page should feel like a clear add-on stop, not a wall of text.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Couples should land here, understand the add-on in seconds, and either unlock it or move on.</p>
            <p>If the add-on is already active, this becomes the natural home for the registry build-out.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
