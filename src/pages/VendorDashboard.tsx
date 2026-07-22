import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CalendarDays, CheckCircle2, Clock, Phone, Mail, X, Check, MapPin, CalendarPlus, Wallet, NotebookPen, ArrowUpRight, CheckCheck, ExternalLink, MessageSquareText, FilePlus2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { vendorHasFullAccess } from '@/lib/vendorAccess';
import { getEntitlementDecision } from '@/lib/entitlements';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import ContextualAssistantAction from '@/components/ContextualAssistantAction';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';
import { WorkspacePageSkeleton } from '@/components/AppLoadingSkeletons';
import { listAcceptedWorkspaceVendorInvitesForUser } from '@/lib/workspaceVendorInvites';
import { vendorPaymentStatusLabel, vendorPaymentStatuses, type VendorPaymentStatus } from '@/lib/vendorPayments';
import {
  createVendorWorkspaceUpdate,
  listVendorWorkspaceUpdates,
  vendorWorkspaceUpdateLabel,
  type VendorWorkspaceUpdate,
  type VendorWorkspaceUpdateType,
} from '@/lib/vendorWorkspaceUpdates';
import {
  createVendorTaskSuggestion,
  listVendorTaskSuggestions,
  type VendorTaskSuggestion,
} from '@/lib/vendorTaskSuggestions';

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
  vendor_internal_notes: string | null;
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

interface VendorTaskDetail {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  description: string | null;
  visibility: string | null;
  priority_level: string | null;
  phase: string | null;
  recommended_role: string | null;
  source_vendor_id: string | null;
}

interface VendorPaymentDetail {
  id: string;
  amount: number;
  payment_date: string | null;
  reference: string | null;
  notes: string | null;
  payee_name: string | null;
  category_name: string | null;
  vendor_id: string | null;
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
  beta_trial_status?: 'inactive' | 'active' | 'expired' | 'cancelled' | null;
  beta_trial_started_at?: string | null;
  beta_trial_expires_at?: string | null;
}

interface WorkspaceInviteRelationship {
  inviteId: string;
  inviteStatus: string;
  acceptedAt: string | null;
  inviteSentAt: string | null;
  inviteContactEmail: string | null;
  inviteContactPhone: string | null;
  inviteMessage: string | null;
  vendorId: string;
  userId: string;
  vendorName: string;
  vendorCategory: string;
  vendorPhone: string | null;
  vendorEmail: string | null;
  vendorNotes: string | null;
  vendorInternalNotes: string | null;
  quotedPrice: number | null;
  amountPaid: number | null;
  paymentDueDate: string | null;
  weddingId: string;
  weddingName: string | null;
  weddingDate: string | null;
  weddingLocation: string | null;
  hasPublicListingConnection: boolean;
}

const vendorStatusOptions = ['considering', 'contacted', 'quoted', 'booked', 'completed', 'rejected'] as const;
type VendorWorkspaceStatus = typeof vendorStatusOptions[number];

function vendorStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'considering':
      return 'Considering';
    case 'contacted':
      return 'Contacted';
    case 'quoted':
      return 'Quoted';
    case 'booked':
      return 'Booked';
    case 'completed':
      return 'Completed';
    case 'rejected':
      return 'Rejected';
    default:
      return status || 'Unknown';
  }
}

export default function VendorDashboard() {
  const { user, profile, isSuperAdmin, rolePreview } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [workspaceInvites, setWorkspaceInvites] = useState<WorkspaceInviteRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingId, setListingId] = useState<string | null>(null);
  const [listing, setListing] = useState<VendorListingAccess | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [calendarBookingId, setCalendarBookingId] = useState<string | null>(null);
  const [savingInternalNotesId, setSavingInternalNotesId] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [savingPaymentStateId, setSavingPaymentStateId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [profilesByUserId, setProfilesByUserId] = useState<Record<string, BookingProfile>>({});
  const [taskSummaryByBookingId, setTaskSummaryByBookingId] = useState<Record<string, VendorTaskSummary>>({});
  const [paymentSummaryByBookingId, setPaymentSummaryByBookingId] = useState<Record<string, VendorPaymentSummary>>({});
  const [taskDetailsByBookingId, setTaskDetailsByBookingId] = useState<Record<string, VendorTaskDetail[]>>({});
  const [paymentDetailsByBookingId, setPaymentDetailsByBookingId] = useState<Record<string, VendorPaymentDetail[]>>({});
  const [workspaceUpdatesByBookingId, setWorkspaceUpdatesByBookingId] = useState<Record<string, VendorWorkspaceUpdate[]>>({});
  const [taskSuggestionsByBookingId, setTaskSuggestionsByBookingId] = useState<Record<string, VendorTaskSuggestion[]>>({});
  const [internalNoteDrafts, setInternalNoteDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, VendorWorkspaceStatus>>({});
  const [paymentStateDrafts, setPaymentStateDrafts] = useState<Record<string, {
    contractAmount: string;
    amountPaid: string;
    paymentStatus: VendorPaymentStatus;
    paymentDueDate: string;
  }>>({});
  const [workspaceUpdateDrafts, setWorkspaceUpdateDrafts] = useState<Record<string, {
    updateType: VendorWorkspaceUpdateType;
    noteMessage: string;
  }>>({});
  const [loadingWorkspaceUpdatesId, setLoadingWorkspaceUpdatesId] = useState<string | null>(null);
  const [savingWorkspaceUpdateId, setSavingWorkspaceUpdateId] = useState<string | null>(null);
  const [savingTaskSuggestionId, setSavingTaskSuggestionId] = useState<string | null>(null);
  const [taskSuggestionDrafts, setTaskSuggestionDrafts] = useState<Record<string, {
    title: string;
    description: string;
    dueDate: string;
  }>>({});

  const vendorPreviewMode = isSuperAdmin && rolePreview === 'vendor';
  const claimedWorkspaceInviteId =
    location.state && typeof (location.state as { claimedWorkspaceInviteId?: unknown }).claimedWorkspaceInviteId === 'string'
      ? (location.state as { claimedWorkspaceInviteId: string }).claimedWorkspaceInviteId
      : null;

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        await loadAcceptedWorkspaceInvites(user.id);

        // Get vendor's listing ID
        const { data: listing } = await supabase
          .from('vendor_listings')
          .select('id, business_name, is_approved, is_verified, verification_requested, subscription_status, subscription_expires_at')
          .eq('user_id', user.id)
          .maybeSingle();

        if (listing) {
          setListing(listing as VendorListingAccess);
          setListingId(listing.id);
          if (vendorPreviewMode || vendorHasFullAccess({
            ...(listing as VendorListingAccess),
            beta_trial_status: profile?.beta_trial_status ?? null,
            beta_trial_started_at: profile?.beta_trial_started_at ?? null,
            beta_trial_expires_at: profile?.beta_trial_expires_at ?? null,
          })) {
            const { data } = await supabase
              .from('vendors')
              .select('id, user_id, name, category, status, price, phone, email, notes, vendor_internal_notes, payment_status, amount_paid, payment_due_date, vendor_calendar_synced_at, created_at')
              .eq('vendor_listing_id', listing.id)
              .order('created_at', { ascending: false });
            if (data) {
              const rows = (data as any[]).map((d) => ({
                ...d,
                price: d.price != null ? Number(d.price) : null,
                amount_paid: d.amount_paid != null ? Number(d.amount_paid) : null,
              })) as Booking[];
              setBookings(rows);
              setInternalNoteDrafts(
                Object.fromEntries(rows.map((row) => [row.id, row.vendor_internal_notes ?? ''])),
              );
              await loadBookingContext(rows);
            } else {
              setBookings([]);
              setProfilesByUserId({});
              setTaskSummaryByBookingId({});
              setPaymentSummaryByBookingId({});
              setTaskDetailsByBookingId({});
              setPaymentDetailsByBookingId({});
              setInternalNoteDrafts({});
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
        } else {
          setListing(null);
          setListingId(null);
          setBookings([]);
          setConnectionRequests([]);
        }
      } catch (error) {
        console.error('Error loading vendor dashboard', error);
        toast({
          title: 'Could not load vendor dashboard',
          description: error instanceof Error ? error.message : 'Please refresh and try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [profile?.beta_trial_expires_at, profile?.beta_trial_started_at, profile?.beta_trial_status, toast, user, vendorPreviewMode]);

  const loadAcceptedWorkspaceInvites = async (vendorUserId: string) => {
    const invites = await listAcceptedWorkspaceVendorInvitesForUser(vendorUserId);

    if (invites.length === 0) {
      setWorkspaceInvites([]);
      return;
    }

    const vendorIds = [...new Set(invites.map((invite) => invite.vendor_id).filter(Boolean))];
    const weddingIds = [...new Set(invites.map((invite) => invite.wedding_id).filter(Boolean))];

    const [vendorsRes, weddingsRes] = await Promise.all([
      vendorIds.length > 0
        ? supabase
            .from('vendors')
            .select('id, user_id, name, category, phone, email, notes, vendor_internal_notes, price, amount_paid, payment_due_date, vendor_listing_id')
            .in('id', vendorIds)
        : Promise.resolve({ data: [], error: null } as any),
      weddingIds.length > 0
        ? supabase
            .from('weddings' as any)
            .select('id, wedding_name, wedding_date, location_county, location_town')
            .in('id', weddingIds)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    if (vendorsRes.error) throw vendorsRes.error;
    if (weddingsRes.error) throw weddingsRes.error;

    const vendorMap = new Map<string, any>(((vendorsRes.data as any[]) ?? []).map((row) => [row.id, row]));
    const weddingMap = new Map<string, any>(((weddingsRes.data as any[]) ?? []).map((row) => [row.id, row]));
    const vendorRows = ((vendorsRes.data as any[]) ?? []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      category: row.category,
      status: null,
      price: row.price != null ? Number(row.price) : null,
      phone: row.phone ?? null,
      email: row.email ?? null,
      notes: row.notes ?? null,
      vendor_internal_notes: row.vendor_internal_notes ?? null,
      payment_status: null,
      amount_paid: row.amount_paid != null ? Number(row.amount_paid) : null,
      payment_due_date: row.payment_due_date ?? null,
      vendor_calendar_synced_at: null,
      created_at: new Date().toISOString(),
    })) as Booking[];

    if (vendorRows.length > 0) {
      setInternalNoteDrafts((prev) => ({
        ...prev,
        ...Object.fromEntries(vendorRows.map((row) => [row.id, row.vendor_internal_notes ?? ''])),
      }));
      await loadBookingContext(vendorRows);
    }

    setWorkspaceInvites(
      invites.map((invite) => {
        const vendor = vendorMap.get(invite.vendor_id);
        const wedding = weddingMap.get(invite.wedding_id);
        const weddingLocation = [wedding?.location_town, wedding?.location_county].filter(Boolean).join(', ') || null;

        return {
          inviteId: invite.id,
          inviteStatus: invite.invite_status,
          acceptedAt: invite.accepted_at,
          inviteSentAt: invite.invite_sent_at,
          inviteContactEmail: invite.invite_contact_email,
          inviteContactPhone: invite.invite_contact_phone,
          inviteMessage: invite.invite_message,
          vendorId: invite.vendor_id,
          userId: vendor?.user_id ?? '',
          vendorName: vendor?.name ?? 'Vendor workspace',
          vendorCategory: vendor?.category ?? 'Vendor',
          vendorPhone: vendor?.phone ?? null,
          vendorEmail: vendor?.email ?? null,
          vendorNotes: vendor?.notes ?? null,
          vendorInternalNotes: vendor?.vendor_internal_notes ?? null,
          quotedPrice: vendor?.price != null ? Number(vendor.price) : null,
          amountPaid: vendor?.amount_paid != null ? Number(vendor.amount_paid) : null,
          paymentDueDate: vendor?.payment_due_date ?? null,
          weddingId: invite.wedding_id,
          weddingName: wedding?.wedding_name ?? null,
          weddingDate: wedding?.wedding_date ?? null,
          weddingLocation,
          hasPublicListingConnection: Boolean(invite.claimed_vendor_listing_id ?? vendor?.vendor_listing_id),
        } satisfies WorkspaceInviteRelationship;
      }),
    );
  };

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
            .select('id, title, due_date, completed, description, visibility, priority_level, phase, recommended_role, source_vendor_id')
            .in('source_vendor_id', bookingIds)
        : Promise.resolve({ data: [], error: null } as any),
      bookingIds.length
        ? supabase
            .from('budget_payments')
            .select('id, vendor_id, amount, payment_date, reference, notes, payee_name, category_name')
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
    setProfilesByUserId((prev) => ({ ...prev, ...nextProfiles }));

    const nextTaskSummary: Record<string, VendorTaskSummary> = {};
    const nextTaskDetails: Record<string, VendorTaskDetail[]> = {};
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
      const currentDetails = nextTaskDetails[task.source_vendor_id] ?? [];
      currentDetails.push({
        id: task.id,
        title: task.title,
        due_date: task.due_date ?? null,
        completed: Boolean(task.completed),
        description: task.description ?? null,
        visibility: task.visibility ?? null,
        priority_level: task.priority_level ?? null,
        phase: task.phase ?? null,
        recommended_role: task.recommended_role ?? null,
        source_vendor_id: task.source_vendor_id ?? null,
      });
      nextTaskDetails[task.source_vendor_id] = currentDetails;
    });
    setTaskSummaryByBookingId((prev) => ({ ...prev, ...nextTaskSummary }));
    Object.values(nextTaskDetails).forEach((tasks) =>
      tasks.sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        return a.title.localeCompare(b.title);
      }),
    );
    setTaskDetailsByBookingId((prev) => ({ ...prev, ...nextTaskDetails }));

    const nextPaymentSummary: Record<string, VendorPaymentSummary> = {};
    const nextPaymentDetails: Record<string, VendorPaymentDetail[]> = {};
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

      const currentDetails = nextPaymentDetails[payment.vendor_id] ?? [];
      currentDetails.push({
        id: payment.id,
        amount: Number(payment.amount ?? 0),
        payment_date: payment.payment_date ?? null,
        reference: payment.reference ?? null,
        notes: payment.notes ?? null,
        payee_name: payment.payee_name ?? null,
        category_name: payment.category_name ?? null,
        vendor_id: payment.vendor_id ?? null,
      });
      nextPaymentDetails[payment.vendor_id] = currentDetails;
    });
    setPaymentSummaryByBookingId((prev) => ({ ...prev, ...nextPaymentSummary }));
    Object.values(nextPaymentDetails).forEach((payments) =>
      payments.sort((a, b) => {
        if (a.payment_date && b.payment_date && a.payment_date !== b.payment_date) return b.payment_date.localeCompare(a.payment_date);
        if (a.payment_date && !b.payment_date) return -1;
        if (!a.payment_date && b.payment_date) return 1;
        return b.amount - a.amount;
      }),
    );
    setPaymentDetailsByBookingId((prev) => ({ ...prev, ...nextPaymentDetails }));
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
  const claimedWorkspaceInvite = claimedWorkspaceInviteId
    ? workspaceInvites.find((invite) => invite.inviteId === claimedWorkspaceInviteId) ?? null
    : null;
  const workspaceDecision = getEntitlementDecision('vendor.analytics', {
    vendorListing: listing,
    bypass: vendorPreviewMode,
  });
  const fullAccess = workspaceDecision.allowed;
  const workspaceInviteBookings = useMemo(
    () =>
      workspaceInvites.map((invite) => ({
        id: invite.vendorId,
        user_id: invite.userId,
        name: invite.vendorName,
        category: invite.vendorCategory,
        status: invite.inviteStatus,
        price: invite.quotedPrice,
        phone: invite.inviteContactPhone || invite.vendorPhone,
        email: invite.inviteContactEmail || invite.vendorEmail,
        notes: invite.vendorNotes || invite.inviteMessage,
        vendor_internal_notes: invite.vendorInternalNotes,
        payment_status: null,
        amount_paid: invite.amountPaid,
        payment_due_date: invite.paymentDueDate,
        vendor_calendar_synced_at: null,
        created_at: invite.acceptedAt || invite.inviteSentAt || new Date().toISOString(),
      })) as Booking[],
    [workspaceInvites],
  );
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
  const selectedBooking = selectedBookingId
    ? bookings.find((booking) => booking.id === selectedBookingId)
      ?? workspaceInviteBookings.find((booking) => booking.id === selectedBookingId)
      ?? null
    : null;
  const selectedProfile = selectedBooking ? profilesByUserId[selectedBooking.user_id] : null;
  const selectedTaskDetails = selectedBooking ? taskDetailsByBookingId[selectedBooking.id] ?? [] : [];
  const selectedPaymentDetails = selectedBooking ? paymentDetailsByBookingId[selectedBooking.id] ?? [] : [];

  const statusColor = (status: string | null) => {
    switch (status) {
      case 'booked':
      case 'completed':
        return 'border border-[hsl(var(--success-soft-border))] bg-[hsl(var(--success-soft))] text-success';
      case 'contacted':
      case 'quoted':
        return 'border border-[hsl(var(--info-soft-border))] bg-[hsl(var(--info-soft))] text-info';
      case 'rejected':
        return 'border border-[hsl(var(--destructive-soft-border))] bg-[hsl(var(--destructive-soft))] text-destructive';
      default:
        return 'border border-border bg-muted text-muted-foreground';
    }
  };
  const formatShortDate = (value: string | null) => {
    if (!value) return 'Not set';
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const openBookingDetail = (bookingId: string) => {
    setSelectedBookingId(bookingId);
  };

  const selectedWorkspaceInvite = selectedBooking
    ? workspaceInvites.find((invite) => invite.vendorId === selectedBooking.id) ?? null
    : null;
  const selectedWorkspaceUpdates = selectedBooking ? workspaceUpdatesByBookingId[selectedBooking.id] ?? [] : [];
  const selectedTaskSuggestions = selectedBooking ? taskSuggestionsByBookingId[selectedBooking.id] ?? [] : [];

  useEffect(() => {
    if (!selectedBooking) return;

    setStatusDrafts((prev) => ({
      ...prev,
      [selectedBooking.id]: (prev[selectedBooking.id] ?? (selectedBooking.status as VendorWorkspaceStatus) ?? 'considering') as VendorWorkspaceStatus,
    }));

    setPaymentStateDrafts((prev) => ({
      ...prev,
      [selectedBooking.id]: prev[selectedBooking.id] ?? {
        contractAmount: selectedBooking.price != null ? String(selectedBooking.price) : '',
        amountPaid: selectedBooking.amount_paid != null ? String(selectedBooking.amount_paid) : '',
        paymentStatus: ((selectedBooking.payment_status || 'unpaid') as VendorPaymentStatus),
        paymentDueDate: selectedBooking.payment_due_date ?? '',
      },
    }));
    setWorkspaceUpdateDrafts((prev) => ({
      ...prev,
      [selectedBooking.id]: prev[selectedBooking.id] ?? {
        updateType: 'on_track',
        noteMessage: '',
      },
    }));
    setTaskSuggestionDrafts((prev) => ({
      ...prev,
      [selectedBooking.id]: prev[selectedBooking.id] ?? {
        title: '',
        description: '',
        dueDate: '',
      },
    }));
  }, [selectedBooking]);

  useEffect(() => {
    if (!selectedWorkspaceInvite) return;

    let cancelled = false;
    setLoadingWorkspaceUpdatesId(selectedWorkspaceInvite.vendorId);

    void Promise.all([
      listVendorWorkspaceUpdates(selectedWorkspaceInvite.vendorId),
      listVendorTaskSuggestions(selectedWorkspaceInvite.vendorId),
    ])
      .then(([updates, suggestions]) => {
        if (cancelled) return;
        setWorkspaceUpdatesByBookingId((prev) => ({
          ...prev,
          [selectedWorkspaceInvite.vendorId]: updates.filter((update) => !update.is_archived),
        }));
        setTaskSuggestionsByBookingId((prev) => ({
          ...prev,
          [selectedWorkspaceInvite.vendorId]: suggestions,
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        toast({
          title: 'Could not load vendor updates',
          description: error instanceof Error ? error.message : 'Please refresh and try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingWorkspaceUpdatesId((current) => (current === selectedWorkspaceInvite.vendorId ? null : current));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceInvite, toast]);

  if (loading) {
    return <WorkspacePageSkeleton compact />;
  }

  const handleSaveInternalNotes = async (bookingId: string) => {
    const nextNotes = (internalNoteDrafts[bookingId] ?? '').trim();
    setSavingInternalNotesId(bookingId);
    const { data, error } = await (supabase.rpc as any)('update_vendor_workspace_record', {
      target_vendor_id: bookingId,
      internal_notes_input: nextNotes || '',
    });

    if (error) {
      toast({
        title: 'Could not save internal notes',
        description: error.message,
        variant: 'destructive',
      });
      setSavingInternalNotesId(null);
      return;
    }

    applyVendorWorkspaceRecord(data);
    toast({
      title: 'Internal notes saved',
      description: 'These notes stay private to your vendor workspace.',
    });
    setSavingInternalNotesId(null);
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

  const applyVendorWorkspaceRecord = (row: any) => {
    const normalized = {
      ...row,
      price: row?.price != null ? Number(row.price) : null,
      amount_paid: row?.amount_paid != null ? Number(row.amount_paid) : null,
      vendor_internal_notes: row?.vendor_internal_notes ?? null,
      payment_due_date: row?.payment_due_date ?? null,
      payment_status: row?.payment_status ?? null,
      status: row?.status ?? null,
    };

    setBookings((prev) =>
      prev.map((booking) =>
        booking.id === normalized.id
          ? {
              ...booking,
              status: normalized.status,
              price: normalized.price,
              amount_paid: normalized.amount_paid,
              payment_status: normalized.payment_status,
              payment_due_date: normalized.payment_due_date,
              vendor_internal_notes: normalized.vendor_internal_notes,
            }
          : booking,
      ),
    );
    setWorkspaceInvites((prev) =>
      prev.map((invite) =>
        invite.vendorId === normalized.id
          ? {
              ...invite,
              quotedPrice: normalized.price,
              amountPaid: normalized.amount_paid,
              paymentDueDate: normalized.payment_due_date,
              vendorInternalNotes: normalized.vendor_internal_notes,
              inviteStatus: invite.inviteStatus,
            }
          : invite,
      ),
    );
    setInternalNoteDrafts((prev) => ({
      ...prev,
      [normalized.id]: normalized.vendor_internal_notes ?? '',
    }));
    setStatusDrafts((prev) => ({
      ...prev,
      [normalized.id]: (normalized.status || 'considering') as VendorWorkspaceStatus,
    }));
    setPaymentStateDrafts((prev) => ({
      ...prev,
      [normalized.id]: {
        contractAmount: normalized.price != null ? String(normalized.price) : '',
        amountPaid: normalized.amount_paid != null ? String(normalized.amount_paid) : '',
        paymentStatus: (normalized.payment_status || 'unpaid') as VendorPaymentStatus,
        paymentDueDate: normalized.payment_due_date ?? '',
      },
    }));
  };

  const handleSaveStatus = async (booking: Booking) => {
    const nextStatus = statusDrafts[booking.id] ?? (booking.status as VendorWorkspaceStatus) ?? 'considering';
    setSavingStatusId(booking.id);
    const { data, error } = await (supabase.rpc as any)('update_vendor_workspace_record', {
      target_vendor_id: booking.id,
      status_input: nextStatus,
    });
    if (error) {
      toast({
        title: 'Could not update vendor status',
        description: error.message,
        variant: 'destructive',
      });
      setSavingStatusId(null);
      return;
    }

    applyVendorWorkspaceRecord(data);
    toast({
      title: 'Vendor status updated',
      description: `${booking.name} now shows ${vendorStatusLabel(nextStatus).toLowerCase()} in this workspace.`,
    });
    setSavingStatusId(null);
  };

  const handleSavePaymentState = async (booking: Booking) => {
    const draft = paymentStateDrafts[booking.id] ?? {
      contractAmount: booking.price != null ? String(booking.price) : '',
      amountPaid: booking.amount_paid != null ? String(booking.amount_paid) : '',
      paymentStatus: (booking.payment_status || 'unpaid') as VendorPaymentStatus,
      paymentDueDate: booking.payment_due_date ?? '',
    };

    const nextContractAmount = draft.contractAmount.trim() === '' ? null : Number(draft.contractAmount);
    const nextAmountPaid = draft.amountPaid.trim() === '' ? 0 : Number(draft.amountPaid);

    if ((draft.contractAmount.trim() !== '' && (!Number.isFinite(nextContractAmount) || nextContractAmount < 0)) || !Number.isFinite(nextAmountPaid) || nextAmountPaid < 0) {
      toast({
        title: 'Invalid payment values',
        description: 'Use zero or greater for the quoted amount and amount paid.',
        variant: 'destructive',
      });
      return;
    }

    setSavingPaymentStateId(booking.id);
    const { data, error } = await (supabase.rpc as any)('update_vendor_workspace_record', {
      target_vendor_id: booking.id,
      contract_amount_input: nextContractAmount,
      amount_paid_input: nextAmountPaid,
      payment_status_input: draft.paymentStatus,
      payment_due_date_input: draft.paymentDueDate || null,
    });

    if (error) {
      toast({
        title: 'Could not update payment state',
        description: error.message,
        variant: 'destructive',
      });
      setSavingPaymentStateId(null);
      return;
    }

    applyVendorWorkspaceRecord(data);
    setPaymentSummaryByBookingId((prev) => ({
      ...prev,
      [booking.id]: {
        ...(prev[booking.id] ?? { total: 0, latestPaymentDate: null, totalPaid: 0 }),
        totalPaid: nextAmountPaid,
      },
    }));
    toast({
      title: 'Payment state updated',
      description: `${booking.name} now shows ${vendorPaymentStatusLabel(draft.paymentStatus).toLowerCase()}.`,
    });
    setSavingPaymentStateId(null);
  };

  const handleToggleTaskCompletion = async (bookingId: string, task: VendorTaskDetail) => {
    setSavingTaskId(task.id);
    const { data, error } = await (supabase.rpc as any)('update_vendor_workspace_task', {
      target_task_id: task.id,
      completed_input: !task.completed,
    });

    if (error) {
      toast({
        title: 'Could not update task',
        description: error.message,
        variant: 'destructive',
      });
      setSavingTaskId(null);
      return;
    }

    const updatedTask = data as Partial<VendorTaskDetail> & { id: string; completed: boolean; due_date?: string | null };
    const currentTasks = taskDetailsByBookingId[bookingId] ?? [];
    const nextTasks = currentTasks
      .map((currentTask) =>
        currentTask.id === updatedTask.id
          ? { ...currentTask, completed: Boolean(updatedTask.completed) }
          : currentTask,
      )
      .sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        return a.title.localeCompare(b.title);
      });
    const openTasks = nextTasks.filter((currentTask) => !currentTask.completed);

    setTaskDetailsByBookingId((prev) => {
      return {
        ...prev,
        [bookingId]: nextTasks,
      };
    });

    setTaskSummaryByBookingId((prev) => {
      return {
        ...prev,
        [bookingId]: {
          total: nextTasks.length,
          open: openTasks.length,
          completed: nextTasks.length - openTasks.length,
          nextDueDate: openTasks
            .map((currentTask) => currentTask.due_date)
            .filter((value): value is string => Boolean(value))
            .sort((left, right) => left.localeCompare(right))[0] ?? null,
        },
      };
    });

    toast({
      title: updatedTask.completed ? 'Task marked complete' : 'Task reopened',
      description: updatedTask.completed
        ? 'This vendor-linked task now shows complete in the shared workspace.'
        : 'This task is back in the active vendor queue.',
    });
    setSavingTaskId(null);
  };

  const handleCreateWorkspaceUpdate = async (bookingId: string) => {
    const draft = workspaceUpdateDrafts[bookingId] ?? {
      updateType: 'on_track' as VendorWorkspaceUpdateType,
      noteMessage: '',
    };

    if (draft.updateType === 'freeform' && !draft.noteMessage.trim()) {
      toast({
        title: 'Add a note first',
        description: 'Freeform vendor updates need a short message before you post them.',
        variant: 'destructive',
      });
      return;
    }

    setSavingWorkspaceUpdateId(bookingId);
    try {
      const created = await createVendorWorkspaceUpdate({
        vendorId: bookingId,
        updateType: draft.updateType,
        noteMessage: draft.noteMessage.trim() || null,
      });

      setWorkspaceUpdatesByBookingId((prev) => ({
        ...prev,
        [bookingId]: [created, ...(prev[bookingId] ?? []).filter((update) => update.id !== created.id)],
      }));
      setWorkspaceUpdateDrafts((prev) => ({
        ...prev,
        [bookingId]: {
          updateType: 'on_track',
          noteMessage: '',
        },
      }));
      toast({
        title: 'Vendor update posted',
        description: 'The couple workspace can now see this update in its own vendor updates feed.',
      });
    } catch (error) {
      toast({
        title: 'Could not post vendor update',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingWorkspaceUpdateId(null);
    }
  };

  const handleCreateTaskSuggestion = async (bookingId: string) => {
    const draft = taskSuggestionDrafts[bookingId] ?? { title: '', description: '', dueDate: '' };
    if (draft.title.trim().length < 3) {
      toast({
        title: 'Add a task title',
        description: 'Describe the action you need from the couple in at least three characters.',
        variant: 'destructive',
      });
      return;
    }

    setSavingTaskSuggestionId(bookingId);
    try {
      const created = await createVendorTaskSuggestion({
        vendorId: bookingId,
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        suggestedDueDate: draft.dueDate || null,
      });
      setTaskSuggestionsByBookingId((prev) => ({
        ...prev,
        [bookingId]: [created, ...(prev[bookingId] ?? []).filter((item) => item.id !== created.id)],
      }));
      setTaskSuggestionDrafts((prev) => ({
        ...prev,
        [bookingId]: { title: '', description: '', dueDate: '' },
      }));
      toast({
        title: 'Task suggested',
        description: 'The couple can review this suggestion before it becomes part of their wedding plan.',
      });
    } catch (error) {
      toast({
        title: 'Could not suggest task',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingTaskSuggestionId(null);
    }
  };

  const vendorUpdateTone = (type: string | null) => {
    switch (type) {
      case 'waiting_on_couple':
      case 'need_approval':
        return 'warning' as const;
      case 'delivered':
        return 'success' as const;
      case 'on_track':
        return 'info' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Track your workspace invites, bookings, and client inquiries.</p>
        </div>
        <ContextualAssistantAction
          prompt="Look at my vendor workspace and tell me the one thing I should do next."
          context={`This vendor has ${bookedCount} confirmed bookings, ${contactedCount} inquiries, ${workspaceInvites.length} workspace invites, and KES ${totalRevenue.toLocaleString()} in quoted revenue.`}
        />
      </div>

      {claimedWorkspaceInvite && (
        <Card className="semantic-surface-success shadow-card">
          <CardContent className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-display text-lg text-foreground">Workspace invite accepted</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You are now connected to {claimedWorkspaceInvite.weddingName || 'a wedding workspace'} as the{' '}
                {claimedWorkspaceInvite.vendorCategory.toLowerCase()} vendor record.
              </p>
            </div>
            {!listingId && (
              <Button asChild variant="outline" className="gap-2 self-start lg:self-auto">
                <Link to="/vendor-settings">
                  Finish your public vendor profile
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {vendorPreviewMode && (
        <Card className="semantic-surface-info">
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

      <Card className="border-border/70 bg-muted/20">
        <CardHeader>
          <CardTitle className="text-base">Professional workspace</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          {[
            { key: 'portfolio', title: 'Advanced portfolio', description: 'Included with Professional for richer business presentation.', badge: 'Professional' },
            { key: 'analytics', title: 'Business analytics', description: 'Included with Professional for clearer inquiry and booking insights.', badge: 'Professional' },
            { key: 'team', title: 'Team workspace', description: 'Team roles and shared professional operations are in development.', badge: 'Coming soon' },
          ].map((item) => (
            <div key={item.key} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-card-foreground">{item.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Badge variant="info">{item.badge}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="semantic-surface-info shadow-card">
        <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-display text-xl text-foreground">Commercial documents</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create quotes, track invoice balances, and issue receipts without leaving your vendor workspace.
            </p>
          </div>
          <Button asChild className="gap-2 self-start lg:self-auto">
            <Link to="/vendor-documents">
              Open documents
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="shadow-card">
          <CardContent className="py-5">
            <p className="text-2xl font-bold text-foreground">{bookedCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Confirmed bookings</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="py-5">
            <p className="text-2xl font-bold text-foreground">{contactedCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Inquiries</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="py-5">
            <p className="text-2xl font-bold text-foreground">{workspaceInvites.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">Workspace invites</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="py-5">
            <p className="text-2xl font-bold text-foreground">
              KES {totalRevenue.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Quoted revenue</p>
          </CardContent>
        </Card>
      </div>

      {!listing && workspaceInvites.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="py-10 text-center text-muted-foreground">
            Set up your vendor listing first to unlock the vendor workflow.
          </CardContent>
        </Card>
      )}

      {workspaceInvites.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Wedding Workspace Invites</CardTitle>
            <p className="text-sm text-muted-foreground">
              These couples or planners added you into their Zania workspace first. You can collaborate here even before your public vendor listing is fully set up.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {workspaceInvites.map((invite) => (
              <div key={invite.inviteId} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                {(() => {
                  const inviteTaskSummary = taskSummaryByBookingId[invite.vendorId] ?? {
                    total: 0,
                    open: 0,
                    completed: 0,
                    nextDueDate: null,
                  };
                  const invitePaymentSummary = paymentSummaryByBookingId[invite.vendorId] ?? {
                    total: 0,
                    totalPaid: invite.amountPaid ?? 0,
                    latestPaymentDate: null,
                  };
                  const inviteOutstandingBalance = Math.max((invite.quotedPrice ?? 0) - (invitePaymentSummary.totalPaid || 0), 0);
                  const inviteProfile = invite.userId ? profilesByUserId[invite.userId] : null;

                  return (
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl text-foreground">
                        {invite.weddingName || 'Wedding workspace'}
                      </p>
                      <Badge variant={invite.inviteStatus === 'claimed' ? 'success' : 'warning'}>
                        {invite.inviteStatus}
                      </Badge>
                      <Badge variant="outline">{invite.vendorCategory}</Badge>
                      <Badge variant={invite.hasPublicListingConnection ? 'success' : 'outline'}>
                        {invite.hasPublicListingConnection ? 'Public profile linked' : 'Private workspace link'}
                      </Badge>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wedding</p>
                        <div className="mt-2 space-y-1 text-sm text-foreground">
                          <p className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            {invite.weddingDate ? formatShortDate(invite.weddingDate) : 'Date not shared yet'}
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            {invite.weddingLocation || 'Location not shared yet'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Couple workspace</p>
                        <div className="mt-2 space-y-1 text-sm text-foreground">
                          <p>{inviteProfile?.full_name || 'Couple account'}</p>
                          <p className="text-muted-foreground">
                            Accepted {formatShortDate(invite.acceptedAt || invite.inviteSentAt)}
                          </p>
                          <p className="text-muted-foreground">
                            {invite.vendorName}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact details</p>
                        <div className="mt-2 space-y-1 text-sm text-foreground">
                          <p className="flex items-center gap-2 break-all">
                            <Mail className="h-4 w-4 text-primary" />
                            {invite.inviteContactEmail || invite.vendorEmail || 'No email saved'}
                          </p>
                          <p className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-primary" />
                            {invite.inviteContactPhone || invite.vendorPhone || 'No phone saved'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next step</p>
                        <div className="mt-2 space-y-2 text-sm text-foreground">
                          <p>
                            {invite.hasPublicListingConnection
                              ? 'Your public listing is already tied into this relationship.'
                              : 'You can keep working privately or finish your public listing later.'}
                          </p>
                          {!invite.hasPublicListingConnection && (
                            <Button asChild size="sm" variant="outline" className="w-full gap-2">
                              <Link to="/vendor-settings">
                                Complete vendor profile
                                <ArrowUpRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            className="w-full gap-2"
                            onClick={() => openBookingDetail(invite.vendorId)}
                          >
                            <ArrowUpRight className="h-4 w-4" />
                            Open workspace details
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shared tasks</p>
                        <div className="mt-2 space-y-1 text-sm text-foreground">
                          <p>{inviteTaskSummary.open} open · {inviteTaskSummary.completed} complete</p>
                          <p className="text-muted-foreground">
                            {inviteTaskSummary.nextDueDate
                              ? `Next due ${formatShortDate(inviteTaskSummary.nextDueDate)}`
                              : 'No due task yet'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</p>
                        <div className="mt-2 space-y-1 text-sm text-foreground">
                          <p>KES {(invite.quotedPrice ?? 0).toLocaleString()} quoted</p>
                          <p className="text-primary">KES {(invitePaymentSummary.totalPaid || 0).toLocaleString()} paid</p>
                          <p className="text-muted-foreground">KES {inviteOutstandingBalance.toLocaleString()} balance</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment activity</p>
                        <div className="mt-2 space-y-1 text-sm text-foreground">
                          <p>{invitePaymentSummary.total} payment{invitePaymentSummary.total === 1 ? '' : 's'} recorded</p>
                          <p className="text-muted-foreground">
                            {invite.paymentDueDate
                              ? `Due ${formatShortDate(invite.paymentDueDate)}`
                              : 'No payment due date'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Private notes</p>
                        <div className="mt-2 space-y-1 text-sm text-foreground">
                          <p className="line-clamp-3">
                            {invite.vendorInternalNotes || 'No private notes saved yet.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {invite.inviteMessage && (
                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invite note</p>
                        <p className="mt-2 text-sm leading-6 text-foreground/85">{invite.inviteMessage}</p>
                      </div>
                    )}

                    {invite.vendorNotes && (
                      <div className="rounded-xl border border-border/70 bg-background p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shared booking notes</p>
                        <p className="mt-2 text-sm leading-6 text-foreground/85">{invite.vendorNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
                  );
                })()}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Connection Requests */}
      {fullAccess && connectionRequests.length > 0 && (
        <Card className="shadow-card border-primary/20">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
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
                    r.status === 'pending' ? 'border-[hsl(var(--warning-soft-border))] bg-[hsl(var(--warning-soft))]' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{r.requester_name}</span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                          r.status === 'pending' ? 'border-[hsl(var(--warning-soft-border))] bg-[hsl(var(--warning-soft))] text-warning' :
                          r.status === 'accepted' ? 'border-[hsl(var(--success-soft-border))] bg-[hsl(var(--success-soft))] text-success' :
                          'border-destructive/25 bg-destructive/8 text-destructive'
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
          <CardTitle>Client Bookings</CardTitle>
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
                  : workspaceInvites.length > 0
                  ? 'Your accepted workspace invites appear above. Bookings tied to your public listing will show here once couples or planners connect them.'
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
                  <Card
                    key={b.id}
                    className="overflow-hidden border-border/70 shadow-card transition hover:border-primary/40 hover:shadow-md"
                  >
                    <CardContent className="p-5">
                      <div
                        className="flex cursor-pointer flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"
                        onClick={() => openBookingDetail(b.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openBookingDetail(b.id);
                          }
                        }}
                      >
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
                                <p className="text-primary">KES {(paymentSummary.totalPaid || 0).toLocaleString()} paid</p>
                                <p className="text-accent-foreground">KES {outstandingBalance.toLocaleString()} balance</p>
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
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAddBookingToCalendar(b);
                            }}
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

      <Dialog open={Boolean(selectedBooking)} onOpenChange={(open) => !open && setSelectedBookingId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          {selectedBooking && (
            <>
              <DialogHeader className="space-y-3 pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{selectedBooking.category}</Badge>
                  <Badge className={statusColor(selectedBooking.status)}>{selectedBooking.status || 'unknown'}</Badge>
                  {selectedWorkspaceInvite && (
                    <Badge variant="info">
                      Workspace invite
                    </Badge>
                  )}
                  {selectedBooking.vendor_calendar_synced_at && (
                    <Badge variant="success" className="gap-1">
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      In Google Calendar
                    </Badge>
                  )}
                </div>
                <DialogTitle className="font-display text-3xl text-foreground">
                  {selectedProfile?.full_name || 'Couple account'}
                </DialogTitle>
                <DialogDescription>
                  {selectedWorkspaceInvite
                    ? 'Review the full workspace relationship, payment trail, vendor-linked tasks, and private delivery notes without leaving your dashboard.'
                    : 'Review the full booking context, payment trail, vendor-linked tasks, and quick contact actions without leaving your dashboard.'}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-border/70 bg-muted/20 p-1">
                  <TabsTrigger value="overview">Couple Overview</TabsTrigger>
                  <TabsTrigger value="payments">Payment History</TabsTrigger>
                  <TabsTrigger value="tasks">Task List</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <Card className="shadow-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="font-display text-xl">Wedding Snapshot</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Wedding date</p>
                          <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            {formatShortDate(selectedProfile?.wedding_date ?? null)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
                          <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                            <MapPin className="h-4 w-4 text-primary" />
                            {selectedProfile?.wedding_location || 'Not shared yet'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quoted amount</p>
                          <p className="mt-2 text-sm font-medium text-foreground">
                            KES {(selectedBooking.price ?? 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding balance</p>
                          <p className="mt-2 text-sm font-medium text-accent-foreground">
                            KES {Math.max((selectedBooking.price ?? 0) - ((paymentSummaryByBookingId[selectedBooking.id]?.totalPaid || 0)), 0).toLocaleString()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="font-display text-xl">Contact Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <a
                          href={selectedBooking.phone ? `tel:${selectedBooking.phone}` : undefined}
                          className={`flex items-center justify-between rounded-xl border border-border/70 p-4 text-sm transition ${
                            selectedBooking.phone
                              ? 'bg-background hover:border-primary/40 hover:bg-primary/5'
                              : 'cursor-not-allowed bg-muted/20 text-muted-foreground'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-primary" />
                            {selectedBooking.phone || 'No phone saved'}
                          </span>
                          {selectedBooking.phone && <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                        </a>
                        <a
                          href={selectedBooking.email ? `mailto:${selectedBooking.email}` : undefined}
                          className={`flex items-center justify-between rounded-xl border border-border/70 p-4 text-sm transition ${
                            selectedBooking.email
                              ? 'bg-background hover:border-primary/40 hover:bg-primary/5'
                              : 'cursor-not-allowed bg-muted/20 text-muted-foreground'
                          }`}
                        >
                          <span className="flex items-center gap-2 break-all">
                            <Mail className="h-4 w-4 text-primary" />
                            {selectedBooking.email || 'No email saved'}
                          </span>
                          {selectedBooking.email && <ExternalLink className="h-4 w-4 text-muted-foreground" />}
                        </a>
                        <Button
                          type="button"
                          className="w-full gap-2"
                          onClick={() => handleAddBookingToCalendar(selectedBooking)}
                          disabled={!selectedProfile?.wedding_date || calendarBookingId === selectedBooking.id}
                        >
                          {calendarBookingId === selectedBooking.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CalendarPlus className="h-4 w-4" />
                          )}
                          Add to Google Calendar
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Zania is prefixed in the event title so vendor bookings stay easy to spot in a busy calendar.
                        </p>
                        <Button asChild variant="outline" className="w-full gap-2">
                          <Link
                            to="/vendor-documents"
                            state={{
                              createDocumentForVendorId: selectedBooking.id,
                              createDocumentRecipientName: selectedProfile?.full_name || 'Couple account',
                              createDocumentRecipientEmail: selectedBooking.email || null,
                              createDocumentRecipientPhone: selectedBooking.phone || null,
                              createDocumentWeddingName: selectedWorkspaceInvite?.weddingName || selectedProfile?.full_name || '',
                              createDocumentBookingLabel: selectedProfile?.full_name || selectedBooking.name,
                            }}
                          >
                            <FilePlus2 className="h-4 w-4" />
                            Create quote or invoice
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-display text-xl">Relationship Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <Label htmlFor={`vendor-status-${selectedBooking.id}`}>Workspace status</Label>
                        <Select
                          value={(statusDrafts[selectedBooking.id] ?? (selectedBooking.status as VendorWorkspaceStatus) ?? 'considering') as string}
                          onValueChange={(value) =>
                            setStatusDrafts((prev) => ({
                              ...prev,
                              [selectedBooking.id]: value as VendorWorkspaceStatus,
                            }))
                          }
                        >
                          <SelectTrigger id={`vendor-status-${selectedBooking.id}`}>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendorStatusOptions.map((status) => (
                              <SelectItem key={status} value={status}>
                                {vendorStatusLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          onClick={() => handleSaveStatus(selectedBooking)}
                          disabled={savingStatusId === selectedBooking.id}
                          className="gap-2"
                        >
                          {savingStatusId === selectedBooking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Save Status
                        </Button>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">What this controls</p>
                        <p className="mt-2">
                          Use this to keep the couple-facing vendor relationship accurate as you move from first contact to booked and completed delivery.
                        </p>
                        <p className="mt-2">
                          For couple-first private vendor records, this is the main operational state vendors can push back into the shared workspace before any public profile setup happens.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-display text-xl">Shared Booking Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedBooking.notes ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm leading-6 text-foreground/85">
                          {selectedBooking.notes}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                          No notes were added to this booking yet.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selectedWorkspaceInvite && (
                    <Card className="shadow-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl">Vendor Updates</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                          Post a clearly labeled vendor update without changing the wedding plan directly. This stays separate from notes and tasks so the couple can review it in context.
                        </div>
                        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                          <div className="space-y-2">
                            <Label htmlFor={`vendor-update-type-${selectedBooking.id}`}>Update type</Label>
                            <Select
                              value={workspaceUpdateDrafts[selectedBooking.id]?.updateType ?? 'on_track'}
                              onValueChange={(value) =>
                                setWorkspaceUpdateDrafts((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? { updateType: 'on_track', noteMessage: '' }),
                                    updateType: value as VendorWorkspaceUpdateType,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger id={`vendor-update-type-${selectedBooking.id}`}>
                                <SelectValue placeholder="Select update type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="waiting_on_couple">Waiting on couple</SelectItem>
                                <SelectItem value="need_approval">Need approval</SelectItem>
                                <SelectItem value="on_track">On track</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="freeform">Freeform note</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`vendor-update-note-${selectedBooking.id}`}>Note</Label>
                            <Textarea
                              id={`vendor-update-note-${selectedBooking.id}`}
                              value={workspaceUpdateDrafts[selectedBooking.id]?.noteMessage ?? ''}
                              onChange={(event) =>
                                setWorkspaceUpdateDrafts((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? { updateType: 'on_track', noteMessage: '' }),
                                    noteMessage: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Add optional delivery context, what you need next, or what changed..."
                              rows={4}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            className="gap-2"
                            onClick={() => handleCreateWorkspaceUpdate(selectedBooking.id)}
                            disabled={savingWorkspaceUpdateId === selectedBooking.id}
                          >
                            {savingWorkspaceUpdateId === selectedBooking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                            Post Vendor Update
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {loadingWorkspaceUpdatesId === selectedBooking.id ? (
                            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading vendor updates...
                            </div>
                          ) : selectedWorkspaceUpdates.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                              No vendor updates posted yet for this workspace relationship.
                            </div>
                          ) : (
                            selectedWorkspaceUpdates.map((update) => (
                              <div key={update.id} className="rounded-xl border border-border/70 bg-background p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline">Vendor update</Badge>
                                    <Badge variant={vendorUpdateTone(update.update_type)}>
                                      {vendorWorkspaceUpdateLabel(update.update_type)}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {formatShortDate(update.created_at)}
                                  </p>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-foreground">
                                  {update.note_message?.trim() || 'No extra note added.'}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="border-t border-border/70 pt-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-foreground">Suggest a planning task</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Propose an action for review. It does not change the wedding plan until the couple accepts it.
                              </p>
                            </div>
                            <Badge variant="info">Vendor suggestion</Badge>
                          </div>
                          <div className="mt-4 grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                              <Label htmlFor={`task-suggestion-title-${selectedBooking.id}`}>Task title</Label>
                              <Input
                                id={`task-suggestion-title-${selectedBooking.id}`}
                                value={taskSuggestionDrafts[selectedBooking.id]?.title ?? ''}
                                onChange={(event) => setTaskSuggestionDrafts((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? { title: '', description: '', dueDate: '' }),
                                    title: event.target.value,
                                  },
                                }))}
                                maxLength={160}
                                placeholder="Approve the final floral palette"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`task-suggestion-due-${selectedBooking.id}`}>Suggested due date</Label>
                              <Input
                                id={`task-suggestion-due-${selectedBooking.id}`}
                                type="date"
                                value={taskSuggestionDrafts[selectedBooking.id]?.dueDate ?? ''}
                                onChange={(event) => setTaskSuggestionDrafts((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? { title: '', description: '', dueDate: '' }),
                                    dueDate: event.target.value,
                                  },
                                }))}
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label htmlFor={`task-suggestion-description-${selectedBooking.id}`}>Context</Label>
                              <Textarea
                                id={`task-suggestion-description-${selectedBooking.id}`}
                                value={taskSuggestionDrafts[selectedBooking.id]?.description ?? ''}
                                onChange={(event) => setTaskSuggestionDrafts((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? { title: '', description: '', dueDate: '' }),
                                    description: event.target.value,
                                  },
                                }))}
                                maxLength={2000}
                                rows={3}
                                placeholder="Explain what is needed and why it matters now."
                              />
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button
                              type="button"
                              status={savingTaskSuggestionId === selectedBooking.id ? 'loading' : 'idle'}
                              loadingText="Sending suggestion"
                              onClick={() => handleCreateTaskSuggestion(selectedBooking.id)}
                            >
                              <FilePlus2 className="h-4 w-4" />
                              Suggest task
                            </Button>
                          </div>
                          {selectedTaskSuggestions.length > 0 ? (
                            <div className="mt-4 space-y-2">
                              {selectedTaskSuggestions.slice(0, 4).map((suggestion) => (
                                <div key={suggestion.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2">
                                  <span className="text-sm text-foreground">{suggestion.title}</span>
                                  <Badge variant={suggestion.status === 'accepted' ? 'success' : suggestion.status === 'dismissed' ? 'outline' : 'warning'}>
                                    {suggestion.status === 'pending' ? 'Waiting for review' : suggestion.status}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                    <CardTitle className="text-xl">Vendor Internal Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Keep your own private reminders here. These notes are not shown to the couple, planner, or committee.
                      </p>
                      <Textarea
                        value={internalNoteDrafts[selectedBooking.id] ?? ''}
                        onChange={(event) =>
                          setInternalNoteDrafts((prev) => ({
                            ...prev,
                            [selectedBooking.id]: event.target.value,
                          }))
                        }
                        placeholder="Add your private follow-up notes, prep reminders, call outcomes, or delivery concerns..."
                        rows={6}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          Last saved notes stay attached to this booking in your vendor workspace.
                        </p>
                        <Button
                          type="button"
                          onClick={() => handleSaveInternalNotes(selectedBooking.id)}
                          disabled={savingInternalNotesId === selectedBooking.id}
                          className="gap-2"
                        >
                          {savingInternalNotesId === selectedBooking.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MessageSquareText className="h-4 w-4" />
                          )}
                          Save Internal Notes
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="payments" className="space-y-4">
                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-display text-xl">Update Payment State</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`contract-amount-${selectedBooking.id}`}>Quoted amount (KES)</Label>
                            <Input
                              id={`contract-amount-${selectedBooking.id}`}
                              inputMode="decimal"
                              value={paymentStateDrafts[selectedBooking.id]?.contractAmount ?? ''}
                              onChange={(event) =>
                                setPaymentStateDrafts((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? {
                                      contractAmount: '',
                                      amountPaid: '',
                                      paymentStatus: 'unpaid' as VendorPaymentStatus,
                                      paymentDueDate: '',
                                    }),
                                    contractAmount: event.target.value,
                                  },
                                }))
                              }
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`amount-paid-${selectedBooking.id}`}>Amount paid (KES)</Label>
                            <Input
                              id={`amount-paid-${selectedBooking.id}`}
                              inputMode="decimal"
                              value={paymentStateDrafts[selectedBooking.id]?.amountPaid ?? ''}
                              onChange={(event) =>
                                setPaymentStateDrafts((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? {
                                      contractAmount: '',
                                      amountPaid: '',
                                      paymentStatus: 'unpaid' as VendorPaymentStatus,
                                      paymentDueDate: '',
                                    }),
                                    amountPaid: event.target.value,
                                  },
                                }))
                              }
                              placeholder="0"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`payment-status-${selectedBooking.id}`}>Payment status</Label>
                            <Select
                              value={paymentStateDrafts[selectedBooking.id]?.paymentStatus ?? 'unpaid'}
                              onValueChange={(value) =>
                                setPaymentStateDrafts((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? {
                                      contractAmount: '',
                                      amountPaid: '',
                                      paymentStatus: 'unpaid' as VendorPaymentStatus,
                                      paymentDueDate: '',
                                    }),
                                    paymentStatus: value as VendorPaymentStatus,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger id={`payment-status-${selectedBooking.id}`}>
                                <SelectValue placeholder="Select payment status" />
                              </SelectTrigger>
                              <SelectContent>
                                {vendorPaymentStatuses.map((status) => (
                                  <SelectItem key={status} value={status}>
                                    {vendorPaymentStatusLabel(status)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`payment-due-date-${selectedBooking.id}`}>Payment due date</Label>
                            <Input
                              id={`payment-due-date-${selectedBooking.id}`}
                              type="date"
                              value={paymentStateDrafts[selectedBooking.id]?.paymentDueDate ?? ''}
                              onChange={(event) =>
                                setPaymentStateDrafts((prev) => ({
                                  ...prev,
                                  [selectedBooking.id]: {
                                    ...(prev[selectedBooking.id] ?? {
                                      contractAmount: '',
                                      amountPaid: '',
                                      paymentStatus: 'unpaid' as VendorPaymentStatus,
                                      paymentDueDate: '',
                                    }),
                                    paymentDueDate: event.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={() => handleSavePaymentState(selectedBooking)}
                          disabled={savingPaymentStateId === selectedBooking.id}
                          className="gap-2"
                        >
                          {savingPaymentStateId === selectedBooking.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                          Save Payment State
                        </Button>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Why this matters</p>
                        <p className="mt-2">
                          This updates the vendor relationship state directly, even when the couple created you privately first and there is no public listing workflow yet.
                        </p>
                        <p className="mt-2">
                          It does not create a new ledger entry. It keeps the shared workspace totals and payment status aligned from the vendor side.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-display text-xl">Full Payment History</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedPaymentDetails.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                          No payments have been recorded for this booking yet.
                        </div>
                      ) : (
                        selectedPaymentDetails.map((payment) => (
                          <div key={payment.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                  KES {payment.amount.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {payment.payee_name || selectedBooking.name}
                                  {payment.category_name ? ` · ${payment.category_name}` : ''}
                                </p>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatShortDate(payment.payment_date)}
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                              <div className="rounded-lg border border-border/60 bg-background p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reference</p>
                                <p className="mt-1 text-foreground">{payment.reference || 'No payment reference saved'}</p>
                              </div>
                              <div className="rounded-lg border border-border/60 bg-background p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                                <p className="mt-1 text-foreground">{payment.notes || 'No payment notes saved'}</p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4">
                  <Card className="shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-display text-xl">Full Task List</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedTaskDetails.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                          No tasks are linked to this booking yet.
                        </div>
                      ) : (
                        selectedTaskDetails.map((task) => (
                          <div key={task.id} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className={`text-sm font-semibold ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                    {task.title}
                                  </p>
                                  <Badge variant={task.completed ? 'success' : 'outline'}>
                                    {task.completed ? 'Completed' : 'Open'}
                                  </Badge>
                                  {task.visibility && <Badge variant="outline">{task.visibility}</Badge>}
                                  {task.priority_level && <Badge variant="outline">{task.priority_level}</Badge>}
                                </div>
                                {task.description && (
                                  <p className="text-sm leading-6 text-muted-foreground">{task.description}</p>
                                )}
                                <div className="pt-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={task.completed ? 'outline' : 'default'}
                                    className="gap-2"
                                    onClick={() => handleToggleTaskCompletion(selectedBooking.id, task)}
                                    disabled={savingTaskId === task.id}
                                  >
                                    {savingTaskId === task.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : task.completed ? (
                                      <NotebookPen className="h-4 w-4" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    {task.completed ? 'Reopen task' : 'Mark complete'}
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-1 text-sm text-muted-foreground sm:text-right">
                                <p>{task.due_date ? `Due ${formatShortDate(task.due_date)}` : 'No due date set'}</p>
                                {task.phase && <p>Phase: {task.phase.replaceAll('_', ' ')}</p>}
                                {task.recommended_role && <p>Suggested owner: {task.recommended_role}</p>}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
