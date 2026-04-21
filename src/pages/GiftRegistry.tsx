import { Gift, HeartHandshake, ShoppingBag, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { useAuth } from '@/contexts/AuthContext';
import { getEntitlementDecision } from '@/lib/entitlements';

const launchHighlights = [
  'Build a wedding wishlist that guests can shop from without duplicate gifting.',
  'Auto-mark purchased gifts so couples always know what is still needed.',
  'Keep registry planning attached to the same wedding workspace as your budget, guests, and tasks.',
];

const comingSoonIdeas = [
  'Curated registry categories for home setup, honeymoon, and couple gifts',
  'Shareable guest-facing registry link',
  'Gift progress tracking and thank-you follow-up support',
];

export default function GiftRegistry() {
  const { profile, isSuperAdmin, rolePreview } = useAuth();
  const { weddingId, entitlements, couplePlanTier, loading } = useWeddingEntitlements();

  const decision = getEntitlementDecision('couple.gift_registry', {
    profile,
    bypass: isSuperAdmin && rolePreview === 'couple',
    weddingEntitlements: entitlements,
    couplePlanTier,
  });

  const canAccessRegistry = decision.allowed && Boolean(weddingId);

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
            Give guests one beautiful place to see what the couple wants, what has already been purchased, and what still
            needs a buyer.
          </p>
        </div>
      </div>

      {!canAccessRegistry && !loading && (
        <InlineUpgradePrompt decision={decision} />
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-primary/10 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-2xl">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Registry workspace
            </CardTitle>
            <CardDescription>
              {canAccessRegistry
                ? 'Your wedding now has registry access. This is the first live surface and we can build the full store flow on top of it next.'
                : 'Registry access is available as a paid wedding add-on. Once enabled, this page becomes the couple’s registry command center.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-5">
              <p className="text-sm font-medium text-foreground">What couples will do here</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {launchHighlights.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="border-border/70">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-foreground">Current status</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {canAccessRegistry
                      ? 'Registry entitlement is active for this wedding. The next build can add item creation, guest purchase links, and strike-off logic.'
                      : 'Registry is not active for this wedding yet.'}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium text-foreground">Commercial role</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    This is a strong wedding-commerce add-on because it brings both couples and guests into a shared gifting flow.
                  </p>
                </CardContent>
              </Card>
            </div>

            {canAccessRegistry && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Registry access is unlocked</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The entitlement and route are now live. The next product step is building the actual registry catalog, wishlist management,
                      guest purchase flow, and purchased-item strike-off experience.
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
              What we can build next
            </CardTitle>
            <CardDescription>
              This add-on is now wired into pricing and access control. These are the next product layers to add.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {comingSoonIdeas.map((item) => (
              <div key={item} className="rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                {item}
              </div>
            ))}
            {!canAccessRegistry && (
              <Button asChild className="w-full">
                <Link to={decision.pricingHref}>{decision.ctaLabel}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
