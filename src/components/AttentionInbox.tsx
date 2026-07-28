import { ArrowRight, BellRing, Check, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { buildAttentionBrief, type AttentionItem } from '@/lib/attention';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface AttentionInboxProps {
  maxItems?: number;
  showEmpty?: boolean;
  className?: string;
}

function itemTone(item: AttentionItem) {
  if (item.priority === 'urgent') return 'semantic-surface-danger';
  if (item.priority === 'action') return 'semantic-surface-warning';
  return 'semantic-surface-info';
}

function priorityLabel(item: AttentionItem) {
  if (item.priority === 'urgent') return 'Urgent';
  if (item.kind === 'waiting') return 'Waiting';
  if (item.kind === 'update') return 'Update';
  return 'Action';
}

export default function AttentionInbox({
  maxItems = 4,
  showEmpty = false,
  className,
}: AttentionInboxProps) {
  const {
    attentionItems,
    unreadAttentionCount,
    attentionLoading,
    updateAttentionState,
  } = useNotifications();
  const assistantPanel = useAssistantPanel();
  const visibleItems = attentionItems.slice(0, maxItems);
  const remainingCount = Math.max(0, attentionItems.length - visibleItems.length);

  if (attentionLoading && attentionItems.length === 0) {
    return (
      <Card className={cn('border-border/70 bg-card/80', className)}>
        <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <BellRing className="h-4 w-4 animate-pulse text-primary" />
          Checking what needs your attention...
        </CardContent>
      </Card>
    );
  }

  if (visibleItems.length === 0) {
    if (!showEmpty) return null;
    return (
      <Card className={cn('semantic-surface-success', className)}>
        <CardContent className="flex items-center gap-3 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80">
            <Check className="h-4 w-4 text-success" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">You are caught up</p>
            <p className="text-xs text-muted-foreground">Zania will place the next important update here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const openBriefing = () => {
    assistantPanel?.openAssistant(
      'Brief me on these attention items. Put the most urgent first and give me a short next-action list.',
      `These are verified Zania attention items for the signed-in user:\n${buildAttentionBrief(visibleItems)}`,
    );
  };

  return (
    <section className={cn('space-y-3', className)} aria-labelledby="zania-attention-heading">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Zania attention</p>
            <Badge variant="outline" className="rounded-full bg-background/80">
              {unreadAttentionCount} new
            </Badge>
            {attentionItems.length > unreadAttentionCount && (
              <span className="text-xs text-muted-foreground">{attentionItems.length} active</span>
            )}
          </div>
          <h2 id="zania-attention-heading" className="workspace-h2 mt-1">What needs you now</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verified requests and updates, ordered by importance.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2 self-start" onClick={openBriefing}>
          <Sparkles className="h-4 w-4" />
          Brief me
        </Button>
      </div>

      <div className="grid gap-3">
        {visibleItems.map((item) => (
          <Card key={item.id} className={cn('overflow-hidden shadow-none', itemTone(item))}>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={item.priority === 'urgent' ? 'destructive' : item.priority === 'action' ? 'warning' : 'info'}
                    className="rounded-full"
                  >
                    {priorityLabel(item)}
                  </Badge>
                  {item.status === 'unread' && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                  {typeof item.metadata.wedding_name === 'string' && item.metadata.wedding_name && (
                    <Badge variant="outline" className="max-w-full truncate rounded-full normal-case tracking-normal">
                      {item.metadata.wedding_name}
                    </Badge>
                  )}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-foreground sm:text-base">{item.title}</h3>
                {item.summary && <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>}
                {item.dueAt && (
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Due {new Date(item.dueAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {item.actionPath && item.actionLabel && (
                  <Button asChild size="sm" className="gap-2">
                    <Link
                      to={item.actionPath}
                      onClick={() => {
                        if (item.status === 'unread') void updateAttentionState(item.id, 'read');
                      }}
                    >
                      {item.actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Dismiss attention item"
                  onClick={() => void updateAttentionState(item.id, 'dismissed')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {remainingCount > 0 && (
        <p className="text-xs font-medium text-muted-foreground">
          Showing the highest-priority {visibleItems.length} of {attentionItems.length} active items.
        </p>
      )}
    </section>
  );
}
