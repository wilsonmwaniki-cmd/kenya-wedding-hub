import { Loader2 } from 'lucide-react';

type PublicLinkStateProps = {
  title?: string;
  message?: string;
  loadingLabel?: string;
};

const pageBackground = 'bg-[radial-gradient(circle_at_top_left,rgba(222,92,43,0.12),transparent_32%),linear-gradient(180deg,rgba(255,249,246,0.98),rgba(255,255,255,0.98))]';

export function PublicLinkLoading({ loadingLabel = 'Opening…' }: PublicLinkStateProps) {
  return (
    <div className={`flex min-h-screen items-center justify-center px-6 ${pageBackground}`}>
      <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-primary" />
        {loadingLabel}
      </div>
    </div>
  );
}

export function PublicLinkUnavailable({
  title = 'Link unavailable',
  message = 'Ask the sender for a new link.',
}: PublicLinkStateProps) {
  return (
    <div className={`flex min-h-screen items-center justify-center px-6 ${pageBackground}`}>
      <main className="w-full max-w-md text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </main>
    </div>
  );
}
