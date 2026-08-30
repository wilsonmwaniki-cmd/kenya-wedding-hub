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
    <header className="space-y-4 border-b border-border/70 pb-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button onClick={onAction} className="self-start sm:self-auto" disabled={actionDisabled}>
          {actionLabel}
        </Button>
      </div>
      <details className="rounded-2xl border border-border/70 bg-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none">View details</summary>
        <div className="border-t border-border/70 p-4">
          <DocumentSummaryRail items={summaryItems} />
        </div>
      </details>
    </header>
  );
}
