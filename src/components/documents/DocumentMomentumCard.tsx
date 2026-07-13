import { BadgeCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { type DocumentMomentumSummary } from '@/lib/documentMomentum';

type Props = {
  title: string;
  subtitle: string;
  summary: DocumentMomentumSummary;
};

export default function DocumentMomentumCard({ title, subtitle, summary }: Props) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Badge variant="info">{summary.readinessLabel}</Badge>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Readiness</span>
          <span className="font-medium text-foreground">{summary.readinessScore}%</span>
        </div>
        <Progress value={summary.readinessScore} className="h-2.5" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {summary.milestones.map((milestone) => (
          <Badge key={milestone.key} variant={milestone.active ? 'success' : 'info'}>
            {milestone.label}
          </Badge>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {summary.checks.map((check) => (
          <div
            key={check.key}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              check.complete
                ? 'border-[hsl(var(--success-soft-border))] bg-[hsl(var(--success-soft))] text-success'
                : 'border-border bg-white/70 text-muted-foreground'
            }`}
          >
            <BadgeCheck className={`h-4 w-4 ${check.complete ? 'text-success' : 'text-muted-foreground/50'}`} />
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
