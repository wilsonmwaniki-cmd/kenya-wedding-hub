import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  approvePlannerChangeRequest,
  describePlannerChangeDetails,
  describePlannerChangeRequest,
  listPendingPlannerChangeRequests,
  rejectPlannerChangeRequest,
  type PlannerChangeRequestRow,
} from '@/lib/plannerChangeRequests';

function changeTypeLabel(request: PlannerChangeRequestRow) {
  const item = request.target_table
    .replace('wedding_', '')
    .replaceAll('_', ' ')
    .replace(/s$/, '');
  return `${item} change`;
}

function requestTitle(request: PlannerChangeRequestRow) {
  return request.target_label || describePlannerChangeRequest(request);
}

function requestDate(value: string) {
  return new Date(value).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface PlannerChangeRequestsCardProps {
  hideWhenEmpty?: boolean;
}

export default function PlannerChangeRequestsCard({
  hideWhenEmpty = false,
}: PlannerChangeRequestsCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [requests, setRequests] = useState<PlannerChangeRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

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

  useEffect(() => {
    if (loading || !location.hash.startsWith('#planner-change-')) return;

    const targetId = location.hash.slice(1);
    const target = document.getElementById(targetId);
    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
      setHighlightedId(targetId.replace('planner-change-', ''));
    });
    const timeout = window.setTimeout(() => setHighlightedId(null), 2600);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [loading, location.hash, location.key, requests.length]);

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
  if (hideWhenEmpty && !loading && requests.length === 0) return null;

  return (
    <Card
      id="planner-change-requests"
      tabIndex={-1}
      className="scroll-mt-24 border-border bg-card shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className="border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {pendingCount} {pendingCount === 1 ? 'change needs' : 'changes need'} your answer
        </p>
        <CardTitle className="workspace-h2 mt-1.5">Review planner changes</CardTitle>
        <p className="text-sm text-muted-foreground">Choose Approve or Decline for each change.</p>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading changes...
          </div>
        ) : requests.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Nothing needs your answer right now.</p>
        ) : (
          <div className="divide-y divide-border">
            {requests.slice(0, 8).map((request) => {
              const busy = actingId === request.id;
              const highlighted = highlightedId === request.id;

              return (
                <div
                  key={request.id}
                  id={`planner-change-${request.id}`}
                  tabIndex={-1}
                  className={`scroll-mt-24 p-5 outline-none transition-[background-color,box-shadow] duration-500 ${
                    highlighted ? 'bg-primary/10 ring-2 ring-inset ring-primary/35' : 'bg-card'
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        {changeTypeLabel(request)}
                      </p>
                      <h3 className="mt-1.5 text-base font-semibold leading-6 text-foreground">
                        {requestTitle(request)}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {describePlannerChangeDetails(request)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">Requested {requestDate(request.created_at)}</p>
                    </div>
                    <div className="relative z-10 grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-11 gap-2 rounded-lg touch-manipulation"
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
                        className="min-h-11 gap-2 rounded-lg touch-manipulation text-destructive hover:text-destructive"
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
      </CardContent>
    </Card>
  );
}
