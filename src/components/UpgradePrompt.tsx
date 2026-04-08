import { Link } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { EntitlementDecision } from '@/lib/entitlements';

export function InlineUpgradePrompt({ decision }: { decision: EntitlementDecision }) {
  return (
    <Alert className="border-primary/20 bg-primary/5">
      <LockKeyhole className="h-4 w-4 text-primary" />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        {decision.title}
        <Badge variant="secondary">{decision.planName}</Badge>
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{decision.description}</p>
        {decision.reasons.length > 0 && (
          <ul className="space-y-1 text-muted-foreground">
            {decision.reasons.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        )}
        <Button asChild size="sm" className="gap-2">
          <Link to="/pricing">
            {decision.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function UpgradePromptDialog({
  open,
  onOpenChange,
  decision,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decision: EntitlementDecision | null;
}) {
  if (!decision) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">{decision.planName}</Badge>
          </div>
          <DialogTitle className="font-display flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-primary" />
            {decision.title}
          </DialogTitle>
          <DialogDescription>{decision.description}</DialogDescription>
        </DialogHeader>
        {decision.reasons.length > 0 && (
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">What’s blocking this right now</p>
            <ul className="space-y-1">
              {decision.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button asChild className="w-full gap-2 sm:w-auto">
            <Link to="/pricing">
              {decision.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
