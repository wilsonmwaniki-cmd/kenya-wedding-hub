import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users, CalendarDays, TrendingUp, CheckCircle2, Clock, Phone, Mail, Sparkles, X, Check, LockKeyhole, ShieldCheck, CreditCard, MapPin, CalendarPlus, Wallet, NotebookPen, ArrowUpRight, CheckCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { vendorHasFullAccess } from '@/lib/vendorAccess';
import { getEntitlementDecision } from '@/lib/entitlements';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';

interface Booking {
  id: string;
  user_id: string;
  name: string;
  category: string;
  status: string | null;
  price: number | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  payment_status: string | null;
  amount_paid: number | null;
  payment_due_date: string | null;
  vendor_calendar_synced_at: string | null;
  created_at: string;
}

interface BookingProfile {
  user_id: string;
  full_name: string | null;
  wedding_date: string | null;
  wedding_location: string | null;
}

interface VendorTaskSummary {
  total: number;
  open: number;
  completed: number;
  nextDueDate: string | null;
}

interface VendorPaymentSummary {
  total: number;
  totalPaid: number;
  latestPaymentDate: string | null;
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

interface VendorListingAccess {
  id: string;
  business_name: string;
  is_approved: boolean;
  is_verified: boolean;
  verification_requested: boolean;
  subscription_status: 'inactive' | 'active' | 'past_due' | 'cancelled';
  subscription_expires_at: string | null;
}

export default function VendorDashboard() {
  const { user, isSuperAdmin, rolePreview } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingId, setListingId] = useState<string | null>(null);
  const [listing, setListing] = useState<VendorListingAccess | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [calendarBookingId, setCalendarBookingId] = useState<string | null>(null);
  const [profilesByUserId, setProfilesByUserId] = useState<Record<string, BookingProfile>>({});
  const [taskSummaryByBookingId, setTaskSummaryByBookingId] = useState<Record<string, VendorTaskSummary>>({});
  const [paymentSummaryByBookingId, setPaymentSummaryByBookingId] = useState<Record<string, VendorPaymentSummary>>({});

  const vendorPreviewMode = isSuperAdmin && rolePreview === 'vendor';

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get vendor's listing ID
      const { data: listing } = await supabase
        .from('vendor_listings')
        .select('id, business_name, is_approved, is_verified, verification_requested, subscription_status, subscription_expires_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (listing) {
        setListing(listing as VendorListingAccess);
        setListingId(listing.id);
        if (vendorPreviewMode || vendorHasFullAccess(listing as VendorListingAccess)) {
          const { data } = await supabase
            .from('vendors')
            .select('id, user_id, name, category, status, price, phone, email, notes, payment_status, amount_paid, payment_due_date, vendor_calendar_synced_at, created_at')
            .eq('vendor_listing_id', listing.id)
            .order('created_at', { ascending: false });
          if (data) {
            const rows = (data as any[]).map((d) => ({
              ...d,
              price: d.price != null ? Number(d.price) : null,
              amount_paid: d.amount_paid != null ? Number(d.amount_paid) : null,
            })) as Booking[];
            setBookings(rows);
            await loadBookingContext(rows);
          } else {
            setBookings([]);
            setProfilesByUserId({});
            setTaskSummaryByBookingId({});
            setPaymentSummaryByBookingId({});
          }

          await loadConnectionRequests(listing.id);
        } else {
          setBookings([]);
          setConnectionRequests([]);
        }
      } else if (vendorPreviewMode) {
        setListing({
          id: 'admin-preview-vendor',
          business_name: 'Admin Preview Vendor',
          is_approved: true,
          is_verified: true,
          verification_requested: false,
          subscription_status: 'active',
          subscription_expires_at: null,
        });
        setListingId(null);
        setBookings([]);
        setConnectionRequests([]);
      }
      setLoading(false);
    };
    load();
  }, [user, vendorPreviewMode]);

  const loadBookingContext = async (rows: Booking[]) => {
    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
    const bookingIds = rows.map((row) => row.id);

    const [profilesRes, tasksRes, paymentsRes] = await Promise.all([
      userIds.length
        ? supabase
            .from('profiles')
            .select('user_id, full_name, wedding_date, wedding_location')
            .in('user_id', userIds)
        : Promise.resolve({ data: [], error: null } as any),
      bookingIds.length
        ? supabase
            .from('tasks')
            .select('id, due_date, completed, source_vendor_id')
            .in('source_vendor_id', bookingIds)
        : Promise.resolve({ data: [], error: null } as any),
      bookingIds.length
        ? supabase
            .from('budget_payments')
            .select('vendor_id, amount, payment_date')
            .in('vendor_id', bookingIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const nextProfiles: Record<string, BookingProfile> = {};
    ((profilesRes.data as any[]) || []).forEach((profile) => {
      nextProfiles[profile.user_id] = {
        user_id: profile.user_id,
        full_name: profile.full_name ?? null,
        wedding_date: profile.wedding_date ?? null,
        wedding_location: profile.wedding_location ?? null,
      };
    });
    setProfilesByUserId(nextProfiles);

    const nextTaskSummary: Record<string, VendorTaskSummary> = {};
    ((tasksRes.data as any[]) || []).forEach((task) => {
      if (!task.source_vendor_id) return;
      const current = nextTaskSummary[task.source_vendor_id] ?? {
        total: 0,
        open: 0,
        completed: 0,
        nextDueDate: null,
      };
      current.total += 1;
      if (task.completed) {
        current.completed += 1;
      } else {
        current.open += 1;
        if (task.due_date && (!current.nextDueDate || task.due_date < current.nextDueDate)) {
          current.nextDueDate = task.due_date;
        }
      }
      nextTaskSummary[task.source_vendor_id] = current;
    });
    setTaskSummaryByBookingId(nextTaskSummary);

    const nextPaymentSummary: Record<string, VendorPaymentSummary> = {};
    ((paymentsRes.data as any[]) || []).forEach((payment) => {
      if (!payment.vendor_id) return;
      const current = nextPaymentSummary[payment.vendor_id] ?? {
        total: 0,
        totalPaid: 0,
        latestPaymentDate: null,
      };
      current.total += 1;
      current.totalPaid += Number(payment.amount ?? 0);
      if (payment.payment_date && (!current.latestPaymentDate || payment.payment_date > current.latestPaymentDate)) {
        current.latestPaymentDate = payment.payment_date;
      }
      nextPaymentSummary[payment.vendor_id] = current;
    });
    setPaymentSummaryByBookingId(nextPaymentSummary);
  };

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
  const workspaceDecision = getEntitlementDecision('vendor.direct_leads', {
    vendorListing: listing,
    bypass: vendorPreviewMode,
  });
  const fullAccess = workspaceDecision.allowed;
  const bookingsSorted = useMemo(
    () =>
      [...bookings].sort((a, b) => {
        const aWeddingDate = profilesByUserId[a.user_id]?.wedding_date || '';
        const bWeddingDate = profilesByUserId[b.user_id]?.wedding_date || '';
        if (aWeddingDate && bWeddingDate && aWeddingDate !== bWeddingDate) {
          return aWeddingDate.localeCompare(bWeddingDate);
        }
        if (a.status === 'booked' && b.status !== 'booked') return -1;
        if (b.status === 'booked' && a.status !== 'booked') return 1;
        return b.created_at.localeCompare(a.created_at);
      }),
    [bookings, profilesByUserId],
  );

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

  const handleAddBookingToCalendar = async (booking: Booking) => {
    const profile = profilesByUserId[booking.user_id];
    const calendarUrl = buildGoogleCalendarUrl({
      title: `Zania · ${listing?.business_name || booking.category} · ${profile?.full_name || 'Wedding Booking'}`,
      date: profile?.wedding_date ?? null,
      location: profile?.wedding_location ?? null,
      description: [
        'Zania vendor booking',
        `Client: ${profile?.full_name || 'Client'}`,
        `Service: ${booking.category}`,
        booking.phone ? `Client phone: ${booking.phone}` : null,
        booking.email ? `Client email: ${booking.email}` : null,
        booking.price ? `Quoted amount: KES ${booking.price.toLocaleString()}` : null,
        booking.notes ? `Notes: ${booking.notes}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    window.open(calendarUrl, '_blank', 'noopener,noreferrer');
    setCalendarBookingId(booking.id);
    const { error } = await (supabase.rpc as any)('mark_vendor_booking_calendar_synced', {
      target_vendor_id: booking.id,
    });
    if (error) {
      toast({
        title: 'Calendar status not saved',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setBookings((prev) =>
        prev.map((row) =>
          row.id === booking.id
            ? { ...row, vendor_calendar_synced_at: new Date().toISOString() }
            : row,
        ),
      );
      toast({
        title: 'Opened in Google Calendar',
        description: 'The booking was sent to Google Calendar with a Zania tag in the event title.',
      });
    }
    setCalendarBookingId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Track your bookings and client inquiries.</p>
      </div>

      {vendorPreviewMode && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 text-sm text-muted-foreground">
            You are previewing the vendor dashboard with admin bypass enabled. Create a real vendor listing in
            <Link to="/vendor-settings" className="ml-1 font-medium text-primary underline-offset-4 hover:underline">
              vendor settings
            </Link>
            {' '}if you want this account to save real vendor profile data while testing.
          </CardContent>
        </Card>
      )}

      {listing && !fullAccess && (
        <InlineUpgradePrompt decision={workspaceDecision} />
      )}

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

      {!listing && (
        <Card className="shadow-card">
          <CardContent className="py-10 text-center text-muted-foreground">
            Set up your vendor listing first to unlock the vendor workflow.
          </CardContent>
        </Card>
      )}

      {/* Connection Requests */}
      {fullAccess && connectionRequests.length > 0 && (
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
          <p className="text-sm text-muted-foreground">
            See the couple, their wedding context, your payment picture, and whether this booking has already been pushed to Google Calendar.
          </p>
        </CardHeader>
        <CardContent>
          {bookings.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="text-muted-foreground">
                {!fullAccess
                  ? 'Bookings and planner requests unlock after subscription and verification.'
                  : listingId
                  ? 'No bookings yet. When couples or planners connect with you, they\'ll appear here.'
                  : 'Set up your listing first to start receiving bookings.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {bookingsSorted.map((b) => {
                const profile = profilesByUserId[b.user_id];
                const taskSummary = taskSummaryByBookingId[b.id] ?? {
                  total: 0,
                  open: 0,
                  completed: 0,
                  nextDueDate: null,
                };
                const paymentSummary = paymentSummaryByBookingId[b.id] ?? {
                  total: 0,
                  totalPaid: b.amount_paid ?? 0,
                  latestPaymentDate: null,
                };
                const outstandingBalance = Math.max((b.price ?? 0) - (paymentSummary.totalPaid || 0), 0);
                const weddingDateLabel = profile?.wedding_date
                  ? new Date(profile.wedding_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : null;

                return (
                  <Card key={b.id} className="overflow-hidden border-border/70 shadow-card">
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-xl font-semibold text-foreground">
                              {profile?.full_name || 'Couple account'}
                            </h3>
                            <Badge className={statusColor(b.status)}>{b.status || 'unknown'}</Badge>
                            <Badge variant="outline">{b.category}</Badge>
                            {b.vendor_calendar_synced_at ? (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCheck className="h-3.5 w-3.5 text-primary" />
                                In Google Calendar
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                Not yet in calendar
                              </Badge>
                            )}
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wedding</p>
                              <div className="mt-2 space-y-1 text-sm text-foreground">
                                <p className="flex items-center gap-2">
                                  <CalendarDays className="h-4 w-4 text-primary" />
                                  {weddingDateLabel || 'Date not shared yet'}
                                </p>
                                <p className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-primary" />
                                  {profile?.wedding_location || 'Location not shared yet'}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client contact</p>
                              <div className="mt-2 space-y-1 text-sm text-foreground">
                                <p className="flex items-center gap-2">
                                  <Phone className="h-4 w-4 text-primary" />
                                  {b.phone || 'No phone saved'}
                                </p>
                                <p className="flex items-center gap-2 break-all">
                                  <Mail className="h-4 w-4 text-primary" />
                                  {b.email || 'No email saved'}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linked tasks</p>
                              <div className="mt-2 space-y-1 text-sm text-foreground">
                                <p>{taskSummary.open} open · {taskSummary.completed} complete</p>
                                <p className="flex items-center gap-2 text-muted-foreground">
                                  <NotebookPen className="h-4 w-4 text-primary" />
                                  {taskSummary.nextDueDate
                                    ? `Next due ${new Date(taskSummary.nextDueDate).toLocaleDateString()}`
                                    : 'No due task yet'}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</p>
                              <div className="mt-2 space-y-1 text-sm text-foreground">
                                <p>KES {(b.price ?? 0).toLocaleString()} quoted</p>
                                <p className="text-emerald-600">KES {(paymentSummary.totalPaid || 0).toLocaleString()} paid</p>
                                <p className="text-amber-700">KES {outstandingBalance.toLocaleString()} balance</p>
                              </div>
                            </div>
                          </div>

                          {b.notes && (
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes from the booking</p>
                              <p className="mt-2 text-sm leading-6 text-foreground/85">{b.notes}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex w-full flex-col gap-3 xl:w-80">
                          <Button
                            type="button"
                            className="w-full gap-2"
                            onClick={() => handleAddBookingToCalendar(b)}
                            disabled={!profile?.wedding_date || calendarBookingId === b.id}
                          >
                            {calendarBookingId === b.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CalendarPlus className="h-4 w-4" />
                            )}
                            Add to Google Calendar
                          </Button>
                          <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">Calendar note</p>
                            <p className="mt-1">
                              We tag the event title with <span className="font-semibold text-primary">Zania</span> so your platform bookings stand out from personal calendar entries.
                            </p>
                            <p className="mt-2">A Google Calendar account is required when the event page opens.</p>
                            {b.vendor_calendar_synced_at && (
                              <p className="mt-2 text-foreground">
                                Added on {new Date(b.vendor_calendar_synced_at).toLocaleDateString()}.
                              </p>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                            <div className="rounded-xl border border-border/70 bg-background p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment activity</p>
                              <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                                <Wallet className="h-4 w-4 text-primary" />
                                {paymentSummary.total} payment{paymentSummary.total === 1 ? '' : 's'} recorded
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {paymentSummary.latestPaymentDate
                                  ? `Latest on ${new Date(paymentSummary.latestPaymentDate).toLocaleDateString()}`
                                  : 'No payments recorded yet'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-background p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking created</p>
                              <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                                <ArrowUpRight className="h-4 w-4 text-primary" />
                                {new Date(b.created_at).toLocaleDateString()}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                This is when the wedding first entered your Zania vendor pipeline.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
