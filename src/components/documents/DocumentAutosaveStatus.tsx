import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocumentAutosaveStatus as AutosaveStatus } from '@/hooks/useDocumentAutosave';

type Props = {
  status: AutosaveStatus;
  onRetry?: () => void;
};

export default function DocumentAutosaveStatus({ status, onRetry }: Props) {
  if (status === 'idle') return null;

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive" role="status">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Autosave failed.</span>
        {onRetry && <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs text-destructive" onClick={onRetry}>Retry</Button>}
      </div>
    );
  }

  if (status === 'saving') {
    return <span className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Saving draft…</span>;
  }

  if (status === 'pending') return <span className="text-xs text-muted-foreground" role="status">Unsaved changes</span>;

  return <span className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />Changes saved automatically</span>;
}
