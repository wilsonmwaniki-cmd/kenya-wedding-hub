import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatedCardDetails } from '@/components/AnimatedCardDetails';
import { Button } from '@/components/ui/button';
import DocumentSummaryRail, { type DocumentSummaryItem } from '@/components/documents/DocumentSummaryRail';

type DocumentWorkspaceHeaderProps = {
  title: string;
  description: string;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
  summaryItems: DocumentSummaryItem[];
};

export default function DocumentWorkspaceHeader({
  title,
  description,
  actionLabel,
  actionDisabled = false,
  onAction,
  summaryItems,
}: DocumentWorkspaceHeaderProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <header className="space-y-3 border-b border-border/70 pb-4 sm:space-y-4 sm:pb-5">
      <div className="flex items-end justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-4xl">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:mt-2 sm:text-sm">{description}</p> : null}
        </div>
        <Button size="sm" onClick={onAction} className="shrink-0 sm:h-10 sm:px-4" disabled={actionDisabled}>
          {actionLabel}
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-medium text-foreground sm:py-3"
          aria-expanded={detailsOpen}
          aria-controls="document-workspace-summary"
          onClick={() => setDetailsOpen((current) => !current)}
        >
          <span>{detailsOpen ? 'Hide details' : 'View details'}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${detailsOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <AnimatedCardDetails open={detailsOpen}>
          <div id="document-workspace-summary" className="border-t border-border/70 p-4">
            <DocumentSummaryRail items={summaryItems} />
          </div>
        </AnimatedCardDetails>
      </div>
    </header>
  );
}
