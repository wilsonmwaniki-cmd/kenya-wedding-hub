import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { listRecentWorkspaceChanges } from '@/lib/recentWorkspaceChanges';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RecentWorkspaceChangesCardProps {
  maxItems?: number;
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
    <Card className={cn('shadow-card', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-xl">Recent changes</CardTitle>
        <p className="text-sm text-muted-foreground">
          Updates shared with you across this workspace.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
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
                  <Badge variant="outline" className="mt-2 max-w-full truncate rounded-full normal-case tracking-normal">
                    {weddingName}
                  </Badge>
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
              className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/45"
            >
              {content}
            </Link>
          ) : (
            <div key={change.id} className="flex min-h-14 items-center gap-3 rounded-xl px-2 py-2">
              {content}
            </div>
          );
        })}

        {changesQuery.isLoading && (
          <p className="rounded-xl bg-muted/35 px-4 py-5 text-sm text-muted-foreground">
            Checking the latest workspace changes...
          </p>
        )}
        {!changesQuery.isLoading && changes.length === 0 && (
          <p className="rounded-xl bg-muted/35 px-4 py-5 text-sm text-muted-foreground">
            No shared changes yet. New requests, payments, signatures, and collaboration updates will appear here.
          </p>
        )}
        {changesQuery.isError && (
          <p className="semantic-surface-danger rounded-xl border px-4 py-5 text-sm">
            Recent changes could not be refreshed right now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
