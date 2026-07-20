import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PendingWriteAction } from '@/lib/aiAssistant';
import { cn } from '@/lib/utils';

function formatActionLabel(toolName: string) {
  return toolName.replaceAll('_', ' ');
}

interface AssistantActionReviewProps {
  actions: PendingWriteAction[];
  confirming?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  className?: string;
}

export default function AssistantActionReview({
  actions,
  confirming = false,
  onConfirm,
  onCancel,
  className,
}: AssistantActionReviewProps) {
  if (actions.length === 0) return null;

  return (
    <section
      className={cn(
        'rounded-3xl border border-[hsl(var(--warning-soft-border))] bg-[hsl(var(--warning-soft))] p-4 text-foreground shadow-card',
        className,
      )}
      aria-label="Review proposed Zania actions"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full border border-[hsl(var(--warning-soft-border))] bg-background/80 p-2 text-warning">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-warning">Review before Zania makes changes</p>
          <p className="mt-1 text-sm text-foreground/75">
            Nothing has changed yet. Confirm only if every action below looks right.
          </p>
          <div className="mt-3 space-y-2">
            {actions.map((action, index) => (
              <div
                key={`${action.toolName}-${index}`}
                className="rounded-2xl border border-[hsl(var(--warning-soft-border))] bg-background/85 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{action.summary}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {formatActionLabel(action.toolName)}
                    </p>
                  </div>
                  {action.destructive ? <Badge variant="destructive">Destructive</Badge> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void onConfirm()} disabled={confirming} className="gap-2">
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {actions.length === 1 ? 'Run this action' : 'Run these actions'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={confirming}>
              Not yet
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
