import { ArrowRight, BellRing, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { buildAttentionBrief, sortAttentionItems, type AttentionItem } from '@/lib/attention';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  TonalCard,
  TonalCardBody,
  TonalCardDescription,
  TonalCardHeader,
} from '@/components/ui/tonal-card';

interface AttentionInboxProps {
  maxItems?: number;
  showEmpty?: boolean;
  compact?: boolean;
  className?: string;
  supplementaryItems?: AttentionItem[];
  onSupplementaryAction?: (item: AttentionItem) => void;
}

function itemTone(item: AttentionItem) {
  if (item.priority === 'urgent') {
    return {
      rail: 'border-l-[#d9363e]',
      label: 'text-[#b4232a]',
      surface: 'bg-[#fff5f4]',
    };
  }
  if (item.priority === 'action') {
    return {
      rail: 'border-l-[#d69a26]',
      label: 'text-[#9b6a0d]',
      surface: 'bg-[#fffaf0]',
    };
  }
  return {
    rail: 'border-l-[#4d83bd]',
    label: 'text-[#356b9f]',
    surface: 'bg-[#f4f8fc]',
  };
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
  compact = false,
  className,
  supplementaryItems = [],
  onSupplementaryAction,
}: AttentionInboxProps) {
  const {
    attentionItems,
    unreadAttentionCount,
    attentionLoading,
    updateAttentionState,
  } = useNotifications();
  const assistantPanel = useAssistantPanel();
  const persistedIds = new Set(attentionItems.map((item) => item.id));
  const persistedSources = new Set(
    attentionItems
      .filter((item) => item.sourceId)
      .map((item) => `${item.sourceType}:${item.sourceId}`),
  );
  const combinedItems = sortAttentionItems([
    ...attentionItems,
    ...supplementaryItems.filter(
      (item) => !persistedSources.has(`${item.sourceType}:${item.sourceId}`),
    ),
  ]);
  const visibleItems = combinedItems.slice(0, maxItems);
  const remainingCount = Math.max(0, combinedItems.length - visibleItems.length);

  if (attentionLoading && combinedItems.length === 0) {
    return (
      <TonalCard tone="porcelain" className={className}>
        <TonalCardBody className={cn('flex items-center gap-3 pt-5 text-sm text-current/60', compact ? 'py-3' : 'py-4')}>
          <BellRing className="h-4 w-4 animate-pulse text-primary" />
          Checking what needs your attention...
        </TonalCardBody>
      </TonalCard>
    );
  }

  if (visibleItems.length === 0) {
    if (!showEmpty) return null;
    return (
      <TonalCard tone="sage" className={className}>
        <TonalCardHeader className={compact ? 'p-4 pb-3' : undefined}>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-current/55">Zania attention</p>
          <h2
            id="zania-attention-heading"
            className={cn('font-editorial font-semibold leading-tight tracking-[-0.025em]', compact ? 'text-lg' : 'text-xl')}
          >
            What needs you now
          </h2>
          <TonalCardDescription>
            Verified requests and updates, ordered by importance.
          </TonalCardDescription>
        </TonalCardHeader>
        <TonalCardBody className={cn(compact && 'px-4 pb-4')}>
          <div className="flex items-start gap-3 border-t border-current/10 pt-4">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div>
              <p className="text-sm font-semibold text-current">You are caught up</p>
              <p className="mt-1 text-xs leading-5 text-current/60">Zania will place the next important update here.</p>
            </div>
          </div>
        </TonalCardBody>
      </TonalCard>
    );
  }

  const openBriefing = () => {
    assistantPanel?.openAssistant(
      'Brief me on these attention items. Put the most urgent first and give me a short next-action list.',
      `These are verified Zania attention items for the signed-in user:\n${buildAttentionBrief(visibleItems)}`,
    );
  };

  return (
    <TonalCard tone="porcelain" className={className} aria-labelledby="zania-attention-heading">
      <TonalCardHeader className={cn('flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between', compact && 'p-4 pb-3')}>
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">Zania attention</p>
            {unreadAttentionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-current/65">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                {unreadAttentionCount} new
              </span>
            )}
            <span className="text-xs text-current/45">{combinedItems.length} active</span>
          </div>
          <h2
            id="zania-attention-heading"
            className={cn('mt-1 font-editorial font-semibold leading-tight tracking-[-0.025em]', compact ? 'text-lg' : 'text-xl')}
          >
            What needs you now
          </h2>
          <TonalCardDescription className="mt-1">
            Verified requests and updates, ordered by importance.
          </TonalCardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={openBriefing}>
          Brief me
        </Button>
      </TonalCardHeader>

      <TonalCardBody className={cn('px-0 pb-0', compact && 'px-0 pb-0')}>
        <div className="border-t border-current/10">
        {visibleItems.map((item) => {
          const persisted = persistedIds.has(item.id);
          const tone = itemTone(item);
          return (
          <article
            key={item.id}
            className={cn(
              'flex flex-col border-b border-l-[3px] border-b-current/10 last:border-b-0 sm:flex-row sm:items-center',
              compact ? 'gap-2 px-4 py-3' : 'gap-3 px-5 py-4 sm:px-7',
              tone.rail,
              tone.surface,
            )}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={cn('text-[0.66rem] font-semibold uppercase tracking-[0.16em]', tone.label)}>
                    {priorityLabel(item)}
                  </span>
                  {item.status === 'unread' && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                  {!compact && typeof item.metadata.wedding_name === 'string' && item.metadata.wedding_name && (
                    <span className="max-w-full truncate text-xs font-medium text-current/55">
                      {item.metadata.wedding_name}
                    </span>
                  )}
                </div>
                <h3 className={cn('font-semibold text-current', compact ? 'mt-1 line-clamp-2 text-sm' : 'mt-2 text-sm sm:text-base')}>
                  {item.title}
                </h3>
                {item.summary && (
                  <p className={cn('text-current/60', compact ? 'mt-0.5 line-clamp-1 text-xs' : 'mt-1 text-sm')}>
                    {item.summary}
                  </p>
                )}
                {item.dueAt && (
                  <p className={cn('text-xs font-medium text-current/55', compact ? 'mt-0.5' : 'mt-1')}>
                    Due {new Date(item.dueAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {item.actionLabel && persisted && item.actionPath && (
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
                {item.actionLabel && !persisted && onSupplementaryAction && (
                  <Button type="button" size="sm" className="gap-2" onClick={() => onSupplementaryAction(item)}>
                    {item.actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {persisted && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Dismiss attention item"
                    onClick={() => void updateAttentionState(item.id, 'dismissed')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
          </article>
          );
        })}
        </div>
      {remainingCount > 0 && (
        <p className="border-t border-current/10 px-5 py-3 text-xs font-medium text-current/50 sm:px-7">
          Showing the highest-priority {visibleItems.length} of {combinedItems.length} active items.
        </p>
      )}
      </TonalCardBody>
    </TonalCard>
  );
}
