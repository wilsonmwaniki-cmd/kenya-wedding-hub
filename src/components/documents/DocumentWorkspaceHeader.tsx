import { FilePlus2 } from 'lucide-react';
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
  return (
    <header className="space-y-5 border-b border-border/70 pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Documents</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Button onClick={onAction} className="gap-2 self-start sm:self-auto" disabled={actionDisabled}>
          <FilePlus2 className="h-4 w-4" />
          {actionLabel}
        </Button>
      </div>
      <DocumentSummaryRail items={summaryItems} />
    </header>
  );
}
