import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, Sparkles, X } from 'lucide-react';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EntitlementDecision } from '@/lib/entitlements';
import { cn } from '@/lib/utils';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';

export interface InlineAssistantCardProps {
  title: string;
  description?: string;
  badgeLabel?: string;
  prompts?: string[];
  response?: string | null;
  error?: string | null;
  loading?: boolean;
  decision?: EntitlementDecision | null;
  canUseAssistant?: boolean;
  emptyStateTitle?: string;
  emptyStateBody?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  onPromptClick?: (prompt: string) => void | Promise<void>;
  fullAssistantPrompt?: string | null;
  fullAssistantHref?: string;
  className?: string;
}

export default function InlineAssistantCard({
  title,
  description,
  badgeLabel = 'AI Assist',
  prompts = [],
  response,
  error,
  loading = false,
  decision,
  canUseAssistant = false,
  emptyStateTitle = 'Ask for the next best move',
  emptyStateBody = 'Use one of the suggested prompts below or open the full assistant for a deeper planning session.',
  dismissible = false,
  onDismiss,
  onPromptClick,
  fullAssistantPrompt,
  fullAssistantHref = '/ai-chat',
  className,
}: InlineAssistantCardProps) {
  const assistantPanel = useAssistantPanel();
  const panelPrompt = fullAssistantPrompt ?? prompts[0] ?? null;

  return (
    <Card className={cn('border-border/60 bg-card/95 shadow-card', className)}>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              {badgeLabel}
            </Badge>
            <div className="space-y-1">
              <CardTitle className="font-display text-xl">{title}</CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
          </div>
          {dismissible && onDismiss ? (
            <Button type="button" variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss assistant card">
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {decision && !canUseAssistant ? (
          <InlineUpgradePrompt decision={decision} />
        ) : (
          <>
            <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Thinking through your workspace...
                </div>
              ) : error ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Could not load AI guidance</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              ) : response ? (
                <div className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-1">
                  <ReactMarkdown>{response}</ReactMarkdown>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{emptyStateTitle}</p>
                  <p className="text-sm text-muted-foreground">{emptyStateBody}</p>
                </div>
              )}
            </div>

            {prompts.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Suggested prompts
                </p>
                <div className="grid gap-2">
                  {prompts.slice(0, 3).map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
                      onClick={() => onPromptClick?.(prompt)}
                      disabled={loading || !canUseAssistant}
                    >
                      <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{prompt}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Need a deeper conversation or write actions? Open the full assistant.
              </p>
              {assistantPanel ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2"
                  onClick={() => assistantPanel.openAssistant(panelPrompt)}
                >
                  Open assistant panel
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button asChild variant="ghost" className="gap-2">
                  <Link to={fullAssistantHref}>
                    Open full assistant
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
