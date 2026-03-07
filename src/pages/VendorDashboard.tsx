import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, CalendarDays, TrendingUp, CheckCircle2, Clock, Phone, Mail, Sparkles, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Booking {
  id: string;
  name: string;
  category: string;
  status: string | null;
  price: number | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

interface ConnectionRequest {
  id: string;
  requester_user_id: string;
  message: string | null;
  status: string;
  created_at: string;
  requester_name: string | null;
  requester_email: string | null;
  wedding_date: string | null;
}

export default function VendorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingId, setListingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get vendor's listing ID
      const { data: listing } = await supabase
        .from('vendor_listings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (listing) {
        setListingId(listing.id);
        // Get all bookings referencing this listing
        const { data } = await supabase
          .from('vendors')
          .select('id, name, category, status, price, phone, email, notes, created_at')
          .eq('vendor_listing_id', listing.id)
          .order('created_at', { ascending: false });
        if (data) setBookings(data.map(d => ({ ...d, price: d.price ? Number(d.price) : null })));

        // Get connection requests
        await loadConnectionRequests(listing.id);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const loadConnectionRequests = async (vendorListingId: string) => {
    const { data: requests } = await supabase
      .from('vendor_connection_requests' as any)
      .select('id, requester_user_id, message, status, created_at')
      .eq('vendor_listing_id', vendorListingId)
      .order('created_at', { ascending: false });

    if (requests && (requests as any[]).length > 0) {
      // Fetch requester profiles
      const userIds = (requests as any[]).map((r: any) => r.requester_user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, wedding_date')
        .in('user_id', userIds);

      // Get emails from auth - we'll use what we have
      const profileMap = new Map<string, any>();
      profiles?.forEach((p: any) => profileMap.set(p.user_id, p));

      const enriched: ConnectionRequest[] = (requests as any[]).map((r: any) => {
        const profile = profileMap.get(r.requester_user_id);
        return {
          ...r,
          requester_name: profile?.full_name || 'Unknown',
          requester_email: null,
          wedding_date: profile?.wedding_date || null,
        };
      });
      setConnectionRequests(enriched);
    }
  };

  const handleRequest = async (requestId: string, action: 'accepted' | 'declined') => {
    setProcessingId(requestId);
    const request = connectionRequests.find(r => r.id === requestId);

    // Update status
    const { error } = await supabase
      .from('vendor_connection_requests' as any)
      .update({ status: action } as any)
      .eq('id', requestId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setProcessingId(null);
      return;
    }

    // If accepted, auto-add vendor to requester's vendor list
    if (action === 'accepted' && request && listingId) {
      const { data: listing } = await supabase
        .from('vendor_listings')
        .select('business_name, category, phone, email')
        .eq('id', listingId)
        .single();

      if (listing) {
        await supabase.from('vendors').insert({
          user_id: request.requester_user_id,
          name: listing.business_name,
          category: listing.category,
          phone: listing.phone,
          email: listing.email,
          status: 'booked',
          vendor_listing_id: listingId,
        } as any);
      }
    }

    // Update local state
    setConnectionRequests(prev =>
      prev.map(r => r.id === requestId ? { ...r, status: action } : r)
    );

    toast({
      title: action === 'accepted' ? 'Connection accepted! 🎉' : 'Request declined',
      description: action === 'accepted'
        ? `You're now connected with ${request?.requester_name}.`
        : 'The request has been declined.',
    });
    setProcessingId(null);
  };

  const bookedCount = bookings.filter(b => b.status === 'booked').length;
  const contactedCount = bookings.filter(b => b.status === 'contacted').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'booked' && b.price)
    .reduce((sum, b) => sum + (b.price || 0), 0);
  const pendingRequests = connectionRequests.filter(r => r.status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusColor = (status: string | null) => {
    switch (status) {
      case 'booked': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'contacted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Track your bookings and client inquiries.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-xl bg-primary/10 p-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{bookedCount}</p>
              <p className="text-sm text-muted-foreground">Confirmed Bookings</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-xl bg-accent p-3">
              <Clock className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{contactedCount}</p>
              <p className="text-sm text-muted-foreground">Inquiries</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-xl bg-primary/10 p-3">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingRequests.length}</p>
              <p className="text-sm text-muted-foreground">Pending Requests</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="rounded-xl bg-primary/10 p-3">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                KES {totalRevenue.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Quoted Revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Requests */}
      {connectionRequests.length > 0 && (
        <Card className="shadow-card border-primary/20">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Connection Requests
              {pendingRequests.length > 0 && (
                <Badge className="ml-2">{pendingRequests.length} new</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {connectionRequests.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    r.status === 'pending' ? 'border-primary/30 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{r.requester_name}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                          r.status === 'accepted' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      {r.wedding_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Wedding: {new Date(r.wedding_date).toLocaleDateString()}
                        </p>
                      )}
                      {r.message && (
                        <p className="mt-2 text-sm text-muted-foreground italic">"{r.message}"</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {r.status === 'pending' && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleRequest(r.id, 'accepted')}
                          disabled={processingId === r.id}
                          className="gap-1"
                        >
                          {processingId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequest(r.id, 'declined')}
                          disabled={processingId === r.id}
                          className="gap-1"
                        >
                          <X className="h-3 w-3" /> Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bookings list */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Client Bookings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground">
                {listingId
                  ? 'No bookings yet. When couples or planners connect with you, they\'ll appear here.'
                  : 'Set up your listing first to start receiving bookings.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-accent/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{b.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(b.status)}`}>
                        {b.status || 'unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span>{b.category}</span>
                      {b.price && <span className="font-medium text-foreground">KES {b.price.toLocaleString()}</span>}
                    </div>
                    {(b.phone || b.email) && (
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {b.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {b.phone}
                          </span>
                        )}
                        {b.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {b.email}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(b.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
