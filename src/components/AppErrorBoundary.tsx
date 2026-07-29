import React from 'react';
import * as Sentry from '@sentry/react';
import { useLocation, useNavigate } from 'react-router-dom';
import BrandWordmark from '@/components/BrandWordmark';
import { Button } from '@/components/ui/button';
import { tryRecoverFromBundleError } from '@/lib/bundleRecovery';
import SupportFeedbackDialog from '@/components/SupportFeedbackDialog';

type BoundaryScope = 'public' | 'workspace';

type ErrorBoundaryInnerProps = {
  children: React.ReactNode;
  fallback: (errorId: string, errorMessage?: string, componentStack?: string) => React.ReactNode;
  scope: BoundaryScope;
};

type ErrorBoundaryInnerState = {
  hasError: boolean;
  errorId: string;
  errorMessage: string;
  componentStack: string;
};

class ErrorBoundaryInner extends React.Component<ErrorBoundaryInnerProps, ErrorBoundaryInnerState> {
  state: ErrorBoundaryInnerState = {
    hasError: false,
    errorId: '',
    errorMessage: '',
    componentStack: '',
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
      errorId: `ZN-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (tryRecoverFromBundleError(error)) return;

    this.setState({
      errorMessage: error?.message || 'Unknown render error',
      componentStack: errorInfo.componentStack || '',
    });

    const eventId = Sentry.captureException(error, {
      tags: {
        boundary_scope: this.props.scope,
      },
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });

    if (eventId && eventId !== this.state.errorId) {
      this.setState({ errorId: eventId });
    }

    console.error(`[${this.props.scope} error boundary]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(
        this.state.errorId,
        this.state.errorMessage,
        this.state.componentStack,
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({
  scope,
  errorId,
  errorMessage,
  componentStack,
}: {
  scope: BoundaryScope;
  errorId: string;
  errorMessage?: string;
  componentStack?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [supportDialogOpen, setSupportDialogOpen] = React.useState(false);
  const showPreviewDiagnostics =
    window.location.hostname === 'localhost'
    || window.location.hostname.endsWith('.vercel.app');

  const primaryTarget = (() => {
    if (scope === 'public') return '/';
    if (location.pathname.startsWith('/admin')) return '/admin';
    if (location.pathname.startsWith('/vendor')) return '/vendor-dashboard';
    if (location.pathname.startsWith('/clients')) return '/clients';
    return '/dashboard';
  })();

  const primaryLabel = scope === 'public' ? 'Back to home' : 'Back to workspace';
  const heading = scope === 'public' ? 'Something went wrong' : 'This workspace hit a problem';
  const body = scope === 'public'
    ? 'The page could not finish loading. Refresh and try again, or return to the main Zania homepage.'
    : 'This part of Zania could not finish rendering. Refresh and try again, or jump back to a safe workspace page.';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(212,118,70,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(212,187,125,0.12),transparent_26%),linear-gradient(180deg,#fbf7f1_0%,#f7f1e8_42%,#f5ede2_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-border/70 bg-background/95 p-8 shadow-[0_28px_90px_rgba(46,26,20,0.12)] backdrop-blur">
          <BrandWordmark size="sm" />
          <div className="mt-8 space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">
              {scope === 'public' ? 'Zania recovery' : 'Workspace recovery'}
            </p>
            <h1 className="font-display text-4xl font-semibold text-foreground">
              {heading}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground">
              {body}
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button variant="outline" onClick={() => navigate(primaryTarget)}>
              {primaryLabel}
            </Button>
            {scope === 'workspace' ? (
              <Button variant="outline" onClick={() => setSupportDialogOpen(true)}>
                Tell us what happened
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <a href={`mailto:hello@planwithzania.com?subject=${encodeURIComponent(`Zania page issue ${errorId || ''}`)}`}>
                  Email Zania
                </a>
              </Button>
            )}
          </div>
          {errorId ? (
            <p className="mt-6 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Reference {errorId}
            </p>
          ) : null}
          {showPreviewDiagnostics && (errorMessage || componentStack) ? (
            <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-destructive">
                Preview diagnostics
              </p>
              {errorMessage ? (
                <p className="mt-2 break-words text-sm font-medium text-foreground">
                  {errorMessage}
                </p>
              ) : null}
              {componentStack ? (
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-background/80 p-3 text-xs leading-5 text-muted-foreground">
                  {componentStack}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {scope === 'workspace' ? (
        <SupportFeedbackDialog
          open={supportDialogOpen}
          onOpenChange={setSupportDialogOpen}
          errorReference={errorId}
          initialCategory="bug"
        />
      ) : null}
    </div>
  );
}

export function PublicErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <ErrorBoundaryInner
      key={`public:${location.pathname}${location.search}${location.hash}`}
      scope="public"
      fallback={(errorId, errorMessage, componentStack) => (
        <ErrorFallback
          scope="public"
          errorId={errorId}
          errorMessage={errorMessage}
          componentStack={componentStack}
        />
      )}
    >
      {children}
    </ErrorBoundaryInner>
  );
}

export function WorkspaceErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <ErrorBoundaryInner
      key={`workspace:${location.pathname}${location.search}${location.hash}`}
      scope="workspace"
      fallback={(errorId, errorMessage, componentStack) => (
        <ErrorFallback
          scope="workspace"
          errorId={errorId}
          errorMessage={errorMessage}
          componentStack={componentStack}
        />
      )}
    >
      {children}
    </ErrorBoundaryInner>
  );
}
