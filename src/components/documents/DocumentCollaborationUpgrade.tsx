import { ArrowRight, Link2, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { buildPricingHref, type ProfessionalAudience } from '@/lib/pricingPlans';

type Props = {
  audience: ProfessionalAudience;
  compact?: boolean;
};

export default function DocumentCollaborationUpgrade({ audience, compact = false }: Props) {
  return (
    <Card className="border-primary/20 bg-primary/[0.045] shadow-none">
      <CardContent className={`flex flex-col gap-4 ${compact ? 'p-4' : 'p-5 sm:flex-row sm:items-center sm:justify-between'}`}>
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {compact ? <LockKeyhole className="h-4 w-4" /> : <Link2 className="h-5 w-5" />}
          </span>
          <div>
            <p className="font-semibold text-foreground">Connect documents with Professional</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Creating and managing documents is free. Upgrade to attach them to Zania couples,
              client workspaces, and in-app requests.
            </p>
          </div>
        </div>
        <Button asChild size={compact ? 'sm' : 'default'} className="shrink-0 gap-2">
          <Link to={buildPricingHref(audience, `${audience}.connected_documents`)}>
            See Professional
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
