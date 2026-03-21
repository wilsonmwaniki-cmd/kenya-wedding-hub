import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, CheckCircle2, XCircle, Store, Users, X, Loader2, Copy, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  approvePlannerCodeLinkRequest,
  ensureMyCollaborationCode,
  rejectPlannerCodeLinkRequest,
} from '@/lib/collaborationCodes';

interface PlannerConnection {
  type: 'planner';
  id: string;
  name: string;
  status: string;
  created_at: string;
  request_source?: string;
}

interface VendorConnection {
  type: 'vendor';
  id: string;
  name: string;
  category: string;
  status: string;
  created_at: string;
}

type Connection = PlannerConnection | VendorConnection;

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'text-muted-foreground' },
  approved: { label: 'Connected', icon: CheckCircle2, className: 'text-primary' },
  accepted: { label: 'Connected', icon: CheckCircle2, className: 'text-primary' },
  rejected: { label: 'Declined', icon: XCircle, className: 'text-destructive' },
  declined: { label: 'Declined', icon: XCircle, className: 'text-destructive' },
};

export default function MyConnections() {
  const { user, profile, rolePreview, isSuperAdmin } = useAuth();
  const { loadLinkedPlanner } = usePlanner();
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [collaborationCode, setCollaborationCode] = useState<string | null>(profile?.collaboration_code ?? null);

  const effectiveCoupleView = profile?.role === 'couple' || (isSuperAdmin && rolePreview === 'couple');

  const loadConnections = async () => {
    if (!user) return;

    const [plannerRes, vendorRes] = await Promise.all([
      supabase
        .from('planner_link_requests')
        .select('id, planner_user_id, status, created_at, request_source')
        .eq('couple_user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('vendor_connection_requests')
        .select('id, vendor_listing_id, status, created_at')
        .eq('requester_user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    const plannerConns: Connection[] = [];
    const vendorConns: Connection[] = [];

    if (plannerRes.data?.length) {
      const plannerIds = plannerRes.data.map((r) => r.planner_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, company_name')
        .in('user_id', plannerIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.company_name || p.full_name || 'Planner']) || []);

      for (const r of plannerRes.data) {
        plannerConns.push({
          type: 'planner',
          id: r.id,
          name: profileMap.get(r.planner_user_id) || 'Planner',
          status: r.status,
          created_at: r.created_at,
          request_source: r.request_source ?? 'couple_interest',
        });
      }
    }

    if (vendorRes.data?.length) {
      const listingIds = vendorRes.data.map((r) => r.vendor_listing_id);
      const { data: listings } = await supabase
        .from('vendor_listings')
        .select('id, business_name, category')
        .in('id', listingIds);
      const listingMap = new Map(listings?.map((l) => [l.id, l]) || []);

      for (const r of vendorRes.data) {
        const listing = listingMap.get(r.vendor_listing_id);
        vendorConns.push({
          type: 'vendor',
          id: r.id,
          name: listing?.business_name || 'Vendor',
          category: listing?.category || '',
          status: r.status,
          created_at: r.created_at,
        });
      }
    }

    setConnections([...plannerConns, ...vendorConns].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    loadConnections();
  }, [user]);

  useEffect(() => {
    if (!user || !effectiveCoupleView) return;
    if (profile?.collaboration_code) {
      setCollaborationCode(profile.collaboration_code);
      return;
    }

    ensureMyCollaborationCode()
      .then((code) => setCollaborationCode(code))
      .catch((error) => {
        console.error('Failed to ensure collaboration code:', error);
      });
  }, [user, effectiveCoupleView, profile?.collaboration_code]);

  if (loading) return null;
  if (connections.length === 0 && !(effectiveCoupleView && collaborationCode)) return null;

  const cancelRequest = async (conn: Connection) => {
    setCancelling(conn.id);
    const table = conn.type === 'planner' ? 'planner_link_requests' : 'vendor_connection_requests';
    const { error } = await supabase.from(table).delete().eq('id', conn.id);
    setCancelling(null);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setConnections(prev => prev.filter(c => c.id !== conn.id));
    toast({ title: 'Request cancelled' });
  };

  const approvePlannerRequest = async (requestId: string) => {
    setCancelling(requestId);
    try {
      await approvePlannerCodeLinkRequest(requestId);
      await Promise.all([loadConnections(), loadLinkedPlanner()]);
      toast({
        title: 'Planner linked',
        description: 'Their workspace now opens your existing wedding progress automatically.',
      });
    } catch (error: any) {
      toast({ title: 'Could not approve request', description: error.message, variant: 'destructive' });
    } finally {
      setCancelling(null);
    }
  };

  const declinePlannerRequest = async (requestId: string) => {
    setCancelling(requestId);
    try {
      await rejectPlannerCodeLinkRequest(requestId);
      await loadConnections();
      toast({ title: 'Request declined' });
    } catch (error: any) {
      toast({ title: 'Could not decline request', description: error.message, variant: 'destructive' });
    } finally {
      setCancelling(null);
    }
  };

  const copyCode = async () => {
    if (!collaborationCode) return;
    await navigator.clipboard.writeText(collaborationCode);
    toast({ title: 'Code copied', description: `${collaborationCode} is ready to share with your planner.` });
  };

  return (
    <div className="space-y-4">
      {effectiveCoupleView && collaborationCode && (
        <Card className="shadow-card border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Couple Collaboration Code
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Share this code with your planner so they can request access to your existing wedding workspace.
              </p>
              <p className="mt-2 font-display text-2xl tracking-[0.2em] text-foreground">{collaborationCode}</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={copyCode}>
              <Copy className="h-4 w-4" />
              Copy code
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            My Connections
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
        {connections.map(conn => {
          const config = statusConfig[conn.status] || statusConfig.pending;
          const StatusIcon = config.icon;
          const plannerConn = conn.type === 'planner' ? conn as PlannerConnection : null;
          const plannerNeedsApproval = plannerConn?.request_source === 'planner_code' && plannerConn.status === 'pending';
          return (
            <div key={conn.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {conn.type === 'planner' ? (
                  <Users className="h-4 w-4 text-primary" />
                ) : (
                  <Store className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">{conn.name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {conn.type === 'planner' ? 'Planner' : (conn as VendorConnection).category}
                  </Badge>
                  {plannerConn?.request_source === 'planner_code' && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Planner requested access
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`flex items-center gap-1 text-xs ${config.className}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {config.label}
                </div>
                {plannerNeedsApproval ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => declinePlannerRequest(conn.id)}
                      disabled={cancelling === conn.id}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => approvePlannerRequest(conn.id)}
                      disabled={cancelling === conn.id}
                    >
                      {cancelling === conn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Approve'}
                    </Button>
                  </div>
                ) : conn.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => cancelRequest(conn)}
                    disabled={cancelling === conn.id}
                  >
                    {cancelling === conn.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        </CardContent>
      </Card>
    </div>
  );
}
