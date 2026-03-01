import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, CalendarDays, TrendingUp, CheckCircle2, Clock, Phone, Mail } from 'lucide-react';

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

export default function VendorDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingId, setListingId] = useState<string | null>(null);

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
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const bookedCount = bookings.filter(b => b.status === 'booked').length;
  const contactedCount = bookings.filter(b => b.status === 'contacted').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'booked' && b.price)
    .reduce((sum, b) => sum + (b.price || 0), 0);

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
      <div className="grid gap-4 sm:grid-cols-3">
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
                  ? 'No bookings yet. When couples or planners add you to their wedding, they\'ll appear here.'
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
