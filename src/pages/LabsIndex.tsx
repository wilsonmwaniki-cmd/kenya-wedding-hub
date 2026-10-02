import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import BrandWordmark from '@/components/BrandWordmark';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { getEnabledLabsFeatures } from '@/lib/featureFlags';
import type { AppRole } from '@/lib/roles';

const featureMeta = {
  professionalNetwork: {
    title: 'Professional Network',
    description: 'Find professionals, ask questions and send messages.',
    href: '/labs/network',
    allowedRoles: ['planner', 'vendor'] as AppRole[],
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
          <h1 className="font-display text-4xl text-foreground">Labs</h1>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleFeatures.map((featureKey) => {
            const feature = featureMeta[featureKey];

            return (
              <Card key={featureKey} className="border-white/70 bg-white/80 shadow-[0_22px_60px_rgba(67,36,20,0.08)] backdrop-blur">
                <CardHeader>
                  <div className="space-y-2">
                    <CardTitle className="font-display text-2xl">{feature.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <Link to={feature.href}>
                    <Button>Open network</Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {visibleFeatures.length === 0 ? (
          <Card className="mt-10 border-white/70 bg-white/80 shadow-[0_22px_60px_rgba(67,36,20,0.08)] backdrop-blur">
            <CardHeader>
              <CardTitle className="font-display text-2xl">No labs available.</CardTitle>
            </CardHeader>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
