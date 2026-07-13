import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  approvePlannerChangeRequest,
  describePlannerChangeRequest,
  listPendingPlannerChangeRequests,
  rejectPlannerChangeRequest,
  type PlannerChangeRequestRow,
} from '@/lib/plannerChangeRequests';

function formatChangeDetails(request: PlannerChangeRequestRow) {
  const payload = request.proposed_payload ?? {};

  if (request.target_table === 'guests') {
    const contact = [payload.email, payload.phone].filter(Boolean).join(' • ');
    return [contact, payload.group_name, payload.category].filter(Boolean).join(' • ');
  }

  if (request.target_table === 'wedding_contributions') {
    const parts = [
      payload.contributor_group,
      payload.purpose,
      payload.pledged_amount ? `Pledged KES ${Number(payload.pledged_amount).toLocaleString()}` : null,
      payload.paid_amount ? `Paid KES ${Number(payload.paid_amount).toLocaleString()}` : null,
    ];
    return parts.filter(Boolean).join(' • ');
  }

  const parts = [
    payload.goal_amount ? `Goal KES ${Number(payload.goal_amount).toLocaleString()}` : null,
    payload.starts_on,
    payload.ends_on,
  ];
  return parts.filter(Boolean).join(' • ');
}

export default function PlannerChangeRequestsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<PlannerChangeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const pendingCount = requests.length;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const rows = await listPendingPlannerChangeRequests(user.id);
      setRequests(rows);
    } catch (error: any) {
      toast({
        title: 'Could not load planner approvals',
        description: error?.message || 'There was a problem loading pending planner changes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const requestsByType = useMemo(() => {
    return {
      guests: requests.filter((request) => request.target_table === 'guests').length,
      contributions: requests.filter((request) => request.target_table === 'wedding_contributions').length,
      rounds: requests.filter((request) => request.target_table === 'contribution_rounds').length,
    };
  }, [requests]);

  const handleApprove = async (request: PlannerChangeRequestRow) => {
    if (!user) return;
    setActingId(request.id);
    try {
      await approvePlannerChangeRequest(request, user.id);
      setRequests((current) => current.filter((row) => row.id !== request.id));
      toast({
        title: 'Planner change approved',
        description: 'The requested update is now live in your wedding workspace.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not approve change',
        description: error?.message || 'The planner request could not be applied right now.',
        variant: 'destructive',
      });
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (request: PlannerChangeRequestRow) => {
    if (!user) return;
    setActingId(request.id);
    try {
      await rejectPlannerChangeRequest(request.id, user.id);
      setRequests((current) => current.filter((row) => row.id !== request.id));
      toast({
        title: 'Planner change declined',
        description: 'The planner can keep working without this update going live.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not decline change',
        description: error?.message || 'The planner request could not be rejected right now.',
        variant: 'destructive',
      });
    } finally {
      setActingId(null);
    }
  };

  if (!user) return null;

  return (
    <Card className="semantic-surface-info shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-info">Planner moderation</p>
            <CardTitle className="workspace-h2 mt-2">Approve planner changes</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Planner edits to sensitive couple-owned areas stay pending until you approve or decline them.
            </p>
          </div>
          <Badge variant={pendingCount > 0 ? 'warning' : 'outline'} className="rounded-full px-3 py-1">
            {pendingCount} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Guest changes</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{requestsByType.guests}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Contributions</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{requestsByType.contributions}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Rounds</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{requestsByType.rounds}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-background/70 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading planner requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-5 text-sm text-muted-foreground">
            No planner changes are waiting on you right now.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.slice(0, 8).map((request) => {
              const busy = actingId === request.id;
              const detail = formatChangeDetails(request);

              return (
                <div key={request.id} className="rounded-2xl border border-border/70 bg-background/85 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full capitalize">
                          {request.target_table.replace('_', ' ')}
                        </Badge>
                        <Badge variant="info" className="rounded-full capitalize">
                          {request.change_type}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{describePlannerChangeRequest(request)}</p>
                      {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
                      <p className="text-xs text-muted-foreground">
                        Requested {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="relative z-10 flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11 gap-2 touch-manipulation"
                        onClick={() => void handleApprove(request)}
                        disabled={busy}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11 gap-2 touch-manipulation text-destructive hover:text-destructive"
                        onClick={() => void handleReject(request)}
                        disabled={busy}
                      >
                        <X className="h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-[hsl(var(--info-soft-border))] bg-background/80 p-4 text-sm text-muted-foreground">
          <p>
            Couple ownership, invite sending, and public-share controls stay with the couple side. Planners can still prepare edits,
            but those changes wait here for approval before they affect the live wedding workspace.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
