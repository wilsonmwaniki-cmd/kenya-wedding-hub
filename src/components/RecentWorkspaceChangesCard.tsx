import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { listRecentWorkspaceChanges } from '@/lib/recentWorkspaceChanges';
import { cn } from '@/lib/utils';
import {
  TonalCard,
  TonalCardBody,
  TonalCardDescription,
  TonalCardHeader,
  TonalCardTitle,
} from '@/components/ui/tonal-card';

interface RecentWorkspaceChangesCardProps {
  maxItems?: number;
  compact?: boolean;
  className?: string;
}

function changeDate(value: string) {
  return new Date(value).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
  });
}

export default function RecentWorkspaceChangesCard({
  maxItems = 5,
  compact = false,
  className,
}: RecentWorkspaceChangesCardProps) {
  const { user } = useAuth();
  const { attentionItems } = useNotifications();
  const newestAttentionMarker = attentionItems[0]
    ? `${attentionItems[0].id}:${attentionItems[0].updatedAt}`
    : 'empty';
  const changesQuery = useQuery({
    queryKey: ['recent-workspace-changes', user?.id ?? null, maxItems, newestAttentionMarker],
    queryFn: () => listRecentWorkspaceChanges(maxItems),
    enabled: Boolean(user),
    staleTime: 30_000,
  });
  const changes = changesQuery.data ?? [];

  return (
    <TonalCard tone="oat" className={className}>
      <TonalCardHeader className={compact ? 'p-4 pb-3' : undefined}>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-current/50">Workspace activity</p>
        <TonalCardTitle className={compact ? 'text-lg' : 'text-xl'}>Recent changes</TonalCardTitle>
        <TonalCardDescription>
          Updates shared with you across this workspace.
        </TonalCardDescription>
      </TonalCardHeader>
      <TonalCardBody className="px-0 pb-0">
        <div className="border-t border-current/10">
        {changes.map((change) => {
          const weddingName = typeof change.metadata.wedding_name === 'string'
            ? change.metadata.wedding_name
            : null;
          const content = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{change.title}</span>
                <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                  {change.summary || 'Workspace activity updated.'}
                </span>
                {weddingName && (
                  <span className="mt-2 block max-w-full truncate text-xs font-medium text-current/55">
                    {weddingName}
                  </span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                {changeDate(change.occurredAt)}
                {change.actionPath && <ArrowRight className="h-4 w-4" />}
              </span>
            </>
          );

          return change.actionPath ? (
            <Link
              key={change.id}
              to={change.actionPath}
              className={cn(
                'flex w-full items-center gap-3 border-b border-current/10 px-4 text-left transition-colors last:border-b-0 hover:bg-white/30 sm:px-7',
                compact ? 'min-h-12 py-2.5' : 'min-h-14 py-3',
              )}
            >
              {content}
            </Link>
          ) : (
            <div
              key={change.id}
              className={cn(
                'flex items-center gap-3 border-b border-current/10 px-4 last:border-b-0 sm:px-7',
                compact ? 'min-h-12 py-2.5' : 'min-h-14 py-3',
              )}
            >
              {content}
            </div>
          );
        })}
        </div>

        {changesQuery.isLoading && (
          <p className="border-t border-current/10 px-4 py-5 text-sm text-current/60 sm:px-7">
            Checking the latest workspace changes...
          </p>
        )}
        {!changesQuery.isLoading && changes.length === 0 && (
          <p className={cn('border-t border-current/10 px-4 text-sm leading-6 text-current/60 sm:px-7', compact ? 'py-4' : 'py-5')}>
            No shared changes yet. New requests, payments, signatures, and collaboration updates will appear here.
          </p>
        )}
        {changesQuery.isError && (
          <p className="border-l-[3px] border-l-[#d9363e] border-t border-current/10 bg-[#fff5f4] px-4 py-5 text-sm text-[#7e2025] sm:px-7">
            Recent changes could not be refreshed right now.
          </p>
        )}
      </TonalCardBody>
    </TonalCard>
  );
}
