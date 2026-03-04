import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, CheckCircle2, XCircle, Store, Users, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PlannerConnection {
  type: 'planner';
  id: string;
  name: string;
  status: string;
  created_at: string;
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [plannerRes, vendorRes] = await Promise.all([
        // Planner link requests
        supabase
          .from('planner_link_requests')
          .select('id, planner_user_id, status, created_at')
          .eq('couple_user_id', user.id)
          .order('created_at', { ascending: false }),
        // Vendor connection requests
        supabase
          .from('vendor_connection_requests')
          .select('id, vendor_listing_id, status, created_at')
          .eq('requester_user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      const plannerConns: Connection[] = [];
      const vendorConns: Connection[] = [];

      // Resolve planner names
      if (plannerRes.data?.length) {
        const plannerIds = plannerRes.data.map(r => r.planner_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, company_name')
          .in('user_id', plannerIds);
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.company_name || p.full_name || 'Planner']) || []);

        for (const r of plannerRes.data) {
          plannerConns.push({
            type: 'planner',
            id: r.id,
            name: profileMap.get(r.planner_user_id) || 'Planner',
            status: r.status,
            created_at: r.created_at,
          });
        }
      }

      // Resolve vendor names
      if (vendorRes.data?.length) {
        const listingIds = vendorRes.data.map(r => r.vendor_listing_id);
        const { data: listings } = await supabase
          .from('vendor_listings')
          .select('id, business_name, category')
          .in('id', listingIds);
        const listingMap = new Map(listings?.map(l => [l.id, l]) || []);

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

    load();
  }, [user]);

  if (loading || connections.length === 0) return null;

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

  return (
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
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className={`flex items-center gap-1 text-xs ${config.className}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {config.label}
                </div>
                {conn.status === 'pending' && (
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
  );
}
