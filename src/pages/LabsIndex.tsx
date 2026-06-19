import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FlaskConical, HeartHandshake, Lock } from 'lucide-react';

import BrandWordmark from '@/components/BrandWordmark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { getEnabledLabsFeatures } from '@/lib/featureFlags';
import type { AppRole } from '@/lib/roles';

const featureMeta = {
  professionalNetwork: {
    title: 'Professional Network',
    description:
      'Preview the private networking workspace for planners and vendors before it returns to the public product.',
    href: '/labs/network',
    icon: HeartHandshake,
    allowedRoles: ['planner', 'vendor'] as AppRole[],
    audienceLabel: 'Planner/Vendor only',
  },
} as const;

export default function LabsIndex() {
  const { profile } = useAuth();
  const enabledFeatures = getEnabledLabsFeatures();
  const visibleFeatures = enabledFeatures.filter((featureKey) => {
    const feature = featureMeta[featureKey];
    return profile?.role ? feature.allowedRoles.includes(profile.role) : false;
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(212,118,70,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(212,187,125,0.12),transparent_26%),linear-gradient(180deg,#fbf7f1_0%,#f7f1e8_42%,#f5ede2_100%)]">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandWordmark size="sm" />
            <Badge variant="outline" className="gap-2 rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-primary">
              <FlaskConical className="h-3.5 w-3.5" />
              Labs
            </Badge>
          </div>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to app
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-primary/75">Private testing</p>
          <h1 className="mt-4 font-display text-4xl text-foreground">Labs</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Use this space to test unfinished features privately on preview deployments before they return to the live Zania product.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleFeatures.map((featureKey) => {
            const feature = featureMeta[featureKey];
            const Icon = feature.icon;

            return (
              <Card key={featureKey} className="border-white/70 bg-white/80 shadow-[0_22px_60px_rgba(67,36,20,0.08)] backdrop-blur">
                <CardHeader className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-2">
                    <CardTitle className="font-display text-2xl">{feature.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="rounded-full border-primary/15 bg-primary/5 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-primary/80"
                      >
                        {feature.audienceLabel}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm leading-6 text-muted-foreground">
                      {feature.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/75">
                    <Lock className="h-3.5 w-3.5" />
                    Preview only
                  </div>
                  <Link to={feature.href}>
                    <Button className="gap-2">
                      Open feature
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {visibleFeatures.length === 0 ? (
          <Card className="mt-10 border-white/70 bg-white/80 shadow-[0_22px_60px_rgba(67,36,20,0.08)] backdrop-blur">
            <CardHeader>
              <CardTitle className="font-display text-2xl">No labs for this account yet</CardTitle>
              <CardDescription className="text-sm leading-6 text-muted-foreground">
                This preview deployment is active, but there are no private features assigned to your current role right now.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
