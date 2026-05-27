import { Suspense, lazy, useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { InlineUpgradePrompt, UpgradePromptDialog } from '@/components/UpgradePrompt';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Trash2, Users, Upload, Download, Mail, Send, Loader2, Eye, EyeOff,
  Link2, Copy, UserCheck, BarChart3, Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import GuestInsights from '@/components/guests/GuestInsights';
import InfoTip from '@/components/InfoTip';
import { getEntitlementDecision } from '@/lib/entitlements';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { getCoupleAddonDefinition } from '@/lib/pricingPlans';
import { startStripeCheckout, syncCoupleCheckout, withCheckoutSessionId } from '@/lib/billing';

const GuestCheckIn = lazy(() => import('@/components/guests/GuestCheckIn'));

interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rsvp_status: string | null;
  meal_preference: string | null;
  plus_one: boolean | null;
  table_number: number | null;
  group_name: string | null;
  category: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  rsvp_token: string;
}

const GUEST_GROUPS = ["Bride's Guests", "Groom's Guests", "Bride's Parents' Guests", "Groom's Parents' Guests"];
const GUEST_CATEGORIES = ['general', 'vip', 'family', 'friends', 'kids', 'vendor'];

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function downloadCsvFile(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const normalized = String(value ?? '');
          return /[",\n]/.test(normalized)
            ? `"${normalized.replace(/"/g, '""')}"`
            : normalized;
        })
        .join(','),
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Guests() {
  const { user, profile, isSuperAdmin, rolePreview } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const { weddingId, entitlements, couplePlanTier, loading: entitlementsLoading, refresh } = useWeddingEntitlements();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [guests, setGuests] = useState<Guest[]>([]);
  const [open, setOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeGuest, setComposeGuest] = useState<Guest | null>(null);
  const [checkInMode, setCheckInMode] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [savingGuestId, setSavingGuestId] = useState<string | null>(null);

  // Add guest form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rsvp, setRsvp] = useState('pending');
  const [groupName, setGroupName] = useState('');
  const [category, setCategory] = useState('general');
  const [mealPreference, setMealPreference] = useState('');
  const [plusOne, setPlusOne] = useState<'yes' | 'no'>('no');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compose state
  const [composeSubject, setComposeSubject] = useState('');
  const [contentText, setContentText] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [composeMode, setComposeMode] = useState<'text' | 'html'>('text');
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const [guestAddonCheckoutLoading, setGuestAddonCheckoutLoading] = useState(false);
  const [processedCheckoutSessionId, setProcessedCheckoutSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (isPlanner && !selectedClient) navigate('/clients');
  }, [isPlanner, selectedClient, navigate]);

  const load = async () => {
    if (!dataOrFilter) return;
    const { data } = await supabase.from('guests').select('*').or(dataOrFilter).order('name');
    if (data) setGuests(data as unknown as Guest[]);
  };

  useEffect(() => { load(); }, [user, selectedClient, dataOrFilter]);

  // File handling
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) { toast({ title: 'Empty file', variant: 'destructive' }); return; }

      const guestRows = rows.map(row => {
        const insert: any = {
          user_id: user.id,
          name: String(row['Name'] || row['name'] || row['Full Name'] || row['full_name'] || '').trim(),
          email: String(row['Email'] || row['email'] || '').trim() || null,
          phone: String(row['Phone'] || row['phone'] || row['Phone Number'] || '').trim() || null,
          rsvp_status: String(row['RSVP'] || row['rsvp_status'] || row['Status'] || 'pending').toLowerCase().trim(),
          meal_preference: String(row['Meal'] || row['meal_preference'] || row['Meal Preference'] || '').trim() || null,
          plus_one: row['Plus One'] === true || row['plus_one'] === true || String(row['Plus One'] || row['plus_one'] || '').toLowerCase() === 'yes',
          group_name: String(row['Group'] || row['group_name'] || '').trim() || null,
          category: String(row['Category'] || row['category'] || 'general').toLowerCase().trim(),
        };
        if (isPlanner && selectedClient) insert.client_id = selectedClient.id;
        return insert;
      }).filter(g => g.name);

      if (guestRows.length === 0) { toast({ title: 'No valid rows', variant: 'destructive' }); return; }
      const { error } = await supabase.from('guests').insert(guestRows);
      if (error) toast({ title: 'Upload error', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Success', description: `${guestRows.length} guests uploaded!` }); load(); }
    } catch (err: any) {
      toast({ title: 'File error', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = async () => {
    downloadCsvFile('guest-list-template.csv', [
      ['Name', 'Email', 'Phone', 'RSVP', 'Meal Preference', 'Plus One', 'Group', 'Category'],
      ['Jane Doe', 'jane@example.com', '+254700000000', 'pending', 'Vegetarian', 'No', "Bride's Guests", 'family'],
    ]);
  };

  const addGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) {
      toast({ title: 'Add a guest name', description: 'Enter the guest name before saving.', variant: 'destructive' });
      return;
    }
    const insert: any = {
      user_id: user.id, name: name.trim(), email: email || null, phone: phone || null,
      rsvp_status: rsvp, group_name: groupName || null, category,
      meal_preference: mealPreference.trim() || null,
      plus_one: plusOne === 'yes',
    };
    if (isPlanner && selectedClient) insert.client_id = selectedClient.id;
    const { error } = await supabase.from('guests').insert(insert);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setName(''); setEmail(''); setPhone(''); setRsvp('pending'); setGroupName(''); setCategory('general'); setMealPreference(''); setPlusOne('no');
    setOpen(false); load();
  };

  const updateRsvp = async (id: string, status: string) => {
    await supabase.from('guests').update({ rsvp_status: status }).eq('id', id);
    load();
  };

  const deleteGuest = async (id: string) => {
    await supabase.from('guests').delete().eq('id', id);
    load();
  };

  const saveGuestDetails = async (guest: Guest, updates: Partial<Guest>) => {
    setSavingGuestId(guest.id);
    const { error } = await supabase.from('guests').update(updates).eq('id', guest.id);
    if (error) {
      toast({ title: 'Could not update guest', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Guest updated', description: `${guest.name} is now up to date.` });
      await load();
    }
    setSavingGuestId(null);
  };

  const guestRsvpDecision = getEntitlementDecision('couple.guest_rsvp_management', {
    profile,
    bypass: isSuperAdmin && rolePreview === 'couple',
    weddingEntitlements: entitlements,
    couplePlanTier,
  });

  const requireGuestRsvpManagement = () => {
    if (guestRsvpDecision.allowed) return true;
    setUpgradePromptOpen(true);
    return false;
  };

  const guestAddon = getCoupleAddonDefinition('guest_rsvp_management_addon');
  const isFocusedGuestUpgrade = searchParams.get('intent') === 'upgrade';
  const guestUpgradeState = searchParams.get('upgrade');
  const checkoutSessionId = searchParams.get('checkout_session_id');

  useEffect(() => {
    if (
      guestUpgradeState !== 'success'
      || !checkoutSessionId
      || processedCheckoutSessionId === checkoutSessionId
      || !profile
    ) {
      return;
    }

    let cancelled = false;
    setProcessedCheckoutSessionId(checkoutSessionId);

    const runSync = async () => {
      try {
        await syncCoupleCheckout(checkoutSessionId);
        if (cancelled) return;

        await refresh();
        if (cancelled) return;

        toast({
          title: 'RSVP & Guest Management unlocked',
          description: 'Your wedding can now collect RSVPs and manage guest coordination in one flow.',
        });
        navigate('/guests?upgrade=success', { replace: true });
      } catch (error: any) {
        if (cancelled) return;
        toast({
          title: 'Payment completed but activation is still pending',
          description: error?.message || 'The checkout succeeded, but we could not sync RSVP & Guest Management yet.',
          variant: 'destructive',
        });
      }
    };

    void runSync();

    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId, guestUpgradeState, navigate, processedCheckoutSessionId, profile, refresh, toast]);

  const handleGuestAddonCheckout = async () => {
    if (!profile) return;

    if (profile.role !== 'couple' && !(isSuperAdmin && rolePreview === 'couple')) {
      toast({
        title: 'Couple owners purchase wedding add-ons',
        description: 'Open this page as the couple workspace owner to add RSVP & Guest Management.',
        variant: 'destructive',
      });
      return;
    }

    if (!weddingId) {
      toast({
        title: 'Create or join a wedding first',
        description: 'This add-on attaches to a specific wedding workspace.',
        variant: 'destructive',
      });
      return;
    }

    if (!guestAddon.stripeMonthlyLookupKey) {
      toast({
        title: 'Checkout is not configured',
        description: 'This add-on does not have a Stripe price configured yet.',
        variant: 'destructive',
      });
      return;
    }

    setGuestAddonCheckoutLoading(true);
    try {
      await startStripeCheckout({
        audience: 'couple',
        feature: 'guest_rsvp_management',
        lookupKey: guestAddon.stripeMonthlyLookupKey,
        cadence: 'monthly',
        weddingId,
        successPath: withCheckoutSessionId('/guests?upgrade=success'),
        cancelPath: '/guests?intent=upgrade&upgrade=cancelled',
      });
    } catch (error: any) {
      toast({
        title: 'Could not start checkout',
        description: error?.message || 'There was a problem creating your Stripe checkout session.',
        variant: 'destructive',
      });
      setGuestAddonCheckoutLoading(false);
    }
  };

  const copyRsvpLink = (guest: Guest) => {
    if (!requireGuestRsvpManagement()) return;
    const url = `${window.location.origin}/rsvp/${guest.rsvp_token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'RSVP link copied!', description: `Share this link with ${guest.name} via WhatsApp or SMS.` });
  };

  const coupleName = profile?.full_name && profile?.partner_name
    ? `${profile.full_name} & ${profile.partner_name}` : profile?.full_name || '';

  const openCompose = (guest?: Guest) => {
    if (!requireGuestRsvpManagement()) return;
    setComposeGuest(guest || null);
    setComposeSubject(''); setContentText(''); setContentHtml('');
    setComposeMode('text'); setShowPreview(false);
    setProgress({ sent: 0, failed: 0, total: 0 }); setComposeOpen(true);
  };

  const sendInviteToGuest = async (guest: Guest) => {
    const { data, error } = await supabase.functions.invoke('send-guest-invite', {
      body: {
        guestName: guest.name, guestEmail: guest.email,
        coupleName: coupleName || undefined,
        weddingDate: profile?.wedding_date, weddingLocation: profile?.wedding_location,
        subject: composeSubject.trim() || undefined,
        contentText: contentText.trim() || undefined,
        contentHtml: composeMode === 'html' && contentHtml.trim() ? contentHtml : undefined,
        rsvpLink: `${window.location.origin}/rsvp/${guest.rsvp_token}`,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  };

  const handleSend = async () => {
    if (!requireGuestRsvpManagement()) return;
    setSending(true);
    const targets = composeGuest
      ? [composeGuest]
      : guests.filter(g => g.email && g.rsvp_status === 'pending');
    setProgress({ sent: 0, failed: 0, total: targets.length });
    let sent = 0, failed = 0;
    for (const guest of targets) {
      try { await sendInviteToGuest(guest); sent++; } catch { failed++; }
      setProgress({ sent, failed, total: targets.length });
    }
    setSending(false);
    toast({
      title: sent > 0 ? 'Invites sent!' : 'Send failed',
      description: `Sent: ${sent}, Failed: ${failed}`,
      variant: failed === targets.length ? 'destructive' : undefined,
    });
    if (sent > 0) setComposeOpen(false);
  };

  const pendingWithEmail = guests.filter(g => g.email && g.rsvp_status === 'pending');

  // Filtered guests
  const visibleGuests = guests.filter(g => {
    const matchesSearch = !searchTerm || [g.name, g.email, g.phone, g.group_name, g.category]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesGroup = filterGroup === 'all' || g.group_name === filterGroup;
    return matchesSearch && matchesGroup;
  });

  const uniqueGroups = [...new Set(guests.map(g => g.group_name).filter(Boolean))] as string[];
  const pendingGuests = guests.filter(g => g.rsvp_status === 'pending').length;
  const declinedGuests = guests.filter(g => g.rsvp_status === 'declined').length;
  const guestsWithEmail = guests.filter(g => Boolean(g.email)).length;

  const selectedGuest = useMemo(
    () => visibleGuests.find((guest) => guest.id === selectedGuestId) ?? null,
    [selectedGuestId, visibleGuests],
  );

  useEffect(() => {
    if (visibleGuests.length === 0) {
      if (selectedGuestId !== null) setSelectedGuestId(null);
      return;
    }

    if (!selectedGuestId || !visibleGuests.some((guest) => guest.id === selectedGuestId)) {
      setSelectedGuestId(visibleGuests[0].id);
    }
  }, [selectedGuestId, visibleGuests]);

  if (isPlanner && !selectedClient) return null;
  if (checkInMode) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening check-in...
            </div>
          </div>
        }
      >
        <GuestCheckIn guests={guests as any} onClose={() => setCheckInMode(false)} onUpdate={load} />
      </Suspense>
    );
  }

  const confirmed = guests.filter(g => g.rsvp_status === 'confirmed').length;
  const guestPrimaryAction = guests.length === 0
    ? 'Add the first guest'
    : pendingWithEmail.length > 0
      ? `Send ${pendingWithEmail.length} pending invite${pendingWithEmail.length === 1 ? '' : 's'}`
      : pendingGuests > 0
        ? 'Follow up missing contact details'
        : 'Review confirmed seating and VIP groups';

  return (
    <div className="space-y-6">
      {(!guestRsvpDecision.allowed || guestUpgradeState) && (isFocusedGuestUpgrade || guestUpgradeState) && (
        <Card className={`border ${guestUpgradeState === 'success' ? 'border-emerald-200 bg-emerald-50/70' : guestUpgradeState === 'cancelled' ? 'border-amber-200 bg-amber-50/70' : 'border-primary/20 bg-primary/5'}`}>
          <CardContent className="px-6 py-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Guest add-on</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-foreground">
              {guestUpgradeState === 'success'
                ? 'RSVP & Guest Management unlocked'
                : 'Add RSVP & Guest Management'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              {guestUpgradeState === 'success'
                ? 'This wedding now has RSVP sending, insights, and check-in tools unlocked.'
                : 'Unlock RSVP links, invite sending, guest insights, and check-in tools without leaving the guest workspace.'}
            </p>
            {!guestRsvpDecision.allowed && (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Button className="gap-2" onClick={() => void handleGuestAddonCheckout()} disabled={guestAddonCheckoutLoading}>
                  {guestAddonCheckoutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Add RSVP & Guest Management
                </Button>
                <Button asChild variant="outline">
                  <Link to="/pricing?audience=couple">See all wedding pricing</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/10 shadow-card">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.95fr] lg:p-8">
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-primary">Guest Workspace</p>
                <InfoTip content="Manage your guest list, RSVP replies, contact details, groups, and invite follow-up in one place." />
              </div>
              <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Keep the guest list moving</h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Guests, RSVPs, and invites in one flow.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Total guests</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{guests.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Everyone currently on the list</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Confirmed</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{confirmed}</p>
                <p className="mt-1 text-xs text-muted-foreground">Guests who have said yes</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Pending</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{pendingGuests}</p>
                <p className="mt-1 text-xs text-muted-foreground">Still waiting on RSVP replies</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Next focus</p>
                <p className="mt-2 text-sm font-medium text-foreground">{guestPrimaryAction}</p>
                <p className="mt-1 text-xs text-muted-foreground">Best next move right now.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background/85 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Guest actions</p>
              <InfoTip content="Use quick actions here to import guests, export a template, start check-in, or send invites in bulk." />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <input type="file" ref={fileInputRef} accept=".csv" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                <Download className="h-4 w-4" /> CSV Template
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-2">
                <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload CSV'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => requireGuestRsvpManagement() && setCheckInMode(true)} className="gap-2">
                <UserCheck className="h-4 w-4" /> Check-In
              </Button>
              {pendingWithEmail.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => openCompose()} className="gap-2">
                  <Send className="h-4 w-4" /> Invite All ({pendingWithEmail.length})
                </Button>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-medium text-foreground">
                {guests.length === 0
                  ? 'Start light, then enrich the details'
                  : `${guestsWithEmail} guest${guestsWithEmail === 1 ? '' : 's'} are email-ready`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {guests.length === 0
                  ? 'A first pass is enough to get started.'
                  : pendingWithEmail.length > 0
                    ? 'You can send invites now.'
                    : 'Focus on missing contact details and RSVP accuracy.'}
              </p>
            </div>

            <div className="mt-4">
              <Dialog open={open} onOpenChange={setOpen}>
                <Button type="button" className="gap-2" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Guest
                </Button>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
                  <DialogHeader><DialogTitle className="font-display">Add Guest</DialogTitle></DialogHeader>
                  <form onSubmit={addGuest} className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Guest name" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="guest@example.com" />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254..." />
                      </div>
                      <div className="space-y-2">
                        <Label>Group</Label>
                        <Select value={groupName} onValueChange={setGroupName}>
                          <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                          <SelectContent>
                            {GUEST_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GUEST_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>RSVP Status</Label>
                        <Select value={rsvp} onValueChange={setRsvp}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Plus One</Label>
                        <Select value={plusOne} onValueChange={(value: 'yes' | 'no') => setPlusOne(value)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="yes">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Meal Preference</Label>
                        <Input value={mealPreference} onChange={e => setMealPreference(e.target.value)} placeholder="Optional meal or dietary note" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full">Add Guest</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {!entitlementsLoading && !guestRsvpDecision.allowed && !isFocusedGuestUpgrade && !guestUpgradeState && (
        <InlineUpgradePrompt decision={guestRsvpDecision} />
      )}

      {/* Tabs: List / Insights */}
      <Tabs
        value={activeTab}
        onValueChange={(nextTab) => {
          if (nextTab === 'insights' && !requireGuestRsvpManagement()) return;
          setActiveTab(nextTab);
        }}
      >
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="list" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Guest List</TabsTrigger>
          <TabsTrigger value="insights" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-4">
          <GuestInsights guests={guests as any} />
        </TabsContent>

        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-0 flex-1 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search guests..."
                className="pl-10"
              />
            </div>
            {uniqueGroups.length > 0 && (
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className="w-40"><SelectValue placeholder="All groups" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {uniqueGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <Card className="overflow-hidden shadow-card">
            <CardContent className="p-0">
              <div className="grid lg:grid-cols-[360px_minmax(0,1fr)]">
                <div className="border-b border-border/70 bg-muted/20 lg:border-b-0 lg:border-r">
                  <div className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Visible</p>
                      <p className="mt-2 text-xl font-semibold text-foreground">{visibleGuests.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Invite ready</p>
                      <p className="mt-2 text-xl font-semibold text-foreground">{pendingWithEmail.length}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Declined</p>
                      <p className="mt-2 text-xl font-semibold text-foreground">{declinedGuests}</p>
                    </div>
                  </div>

                  <div className="max-h-[620px] space-y-2 overflow-y-auto border-t border-border/70 p-3">
                    {visibleGuests.length > 0 ? (
                      visibleGuests.map((g) => {
                        const isSelected = selectedGuest?.id === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setSelectedGuestId(g.id)}
                            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                              isSelected
                                ? 'border-primary bg-primary/6 shadow-sm'
                                : 'border-border/70 bg-background hover:border-primary/40 hover:bg-muted/20'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{g.name}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Badge variant={g.rsvp_status === 'confirmed' ? 'default' : g.rsvp_status === 'declined' ? 'destructive' : 'secondary'} className="capitalize">
                                    {g.rsvp_status || 'pending'}
                                  </Badge>
                                  {g.category && g.category !== 'general' && (
                                    <Badge variant="secondary" className="text-[10px] capitalize">{g.category}</Badge>
                                  )}
                                  {g.group_name && (
                                    <Badge variant="outline" className="text-[10px]">{g.group_name}</Badge>
                                  )}
                                </div>
                              </div>
                              <Users className={`h-4 w-4 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <p className="mt-3 truncate text-xs text-muted-foreground">
                              {g.email || g.phone || 'No contact details yet'}
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/80 bg-background/80 p-6 text-center">
                        <p className="text-sm font-medium text-foreground">
                          {searchTerm || filterGroup !== 'all' ? 'No guests match this view' : 'No guests added yet'}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {searchTerm || filterGroup !== 'all'
                            ? 'Try a different name, phone, email, or group search.'
                            : 'Add the first guest and start shaping the wedding headcount.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-background">
                  {selectedGuest ? (
                    <div className="space-y-6 p-5 lg:p-6">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={selectedGuest.rsvp_status === 'confirmed' ? 'default' : selectedGuest.rsvp_status === 'declined' ? 'destructive' : 'secondary'} className="capitalize">
                              {selectedGuest.rsvp_status || 'pending'}
                            </Badge>
                            {selectedGuest.category && selectedGuest.category !== 'general' && (
                              <Badge variant="secondary" className="capitalize">{selectedGuest.category}</Badge>
                            )}
                            {selectedGuest.group_name && (
                              <Badge variant="outline">{selectedGuest.group_name}</Badge>
                            )}
                          </div>
                          <div>
                            <h2 className="font-display text-2xl font-semibold text-foreground">{selectedGuest.name}</h2>
                            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                              Everything for this guest, in one place.
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          className="gap-2 text-destructive hover:text-destructive"
                          onClick={() => deleteGuest(selectedGuest.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete guest
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Contact</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{selectedGuest.email || selectedGuest.phone || 'Missing'}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Plus One</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{selectedGuest.plus_one ? 'Allowed' : 'Not listed'}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Meal</p>
                          <p className="mt-2 text-sm font-medium text-foreground">{selectedGuest.meal_preference || 'Not set'}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-border/70 bg-background p-4">
                            <p className="text-sm font-medium text-foreground">Guest details</p>
                            <p className="mt-1 text-sm text-muted-foreground">Update and save core details.</p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2 sm:col-span-2">
                                <Label>Name</Label>
                                <Input
                                  value={selectedGuest.name}
                                  onChange={(e) => setGuests((prev) => prev.map((guest) => guest.id === selectedGuest.id ? { ...guest, name: e.target.value } : guest))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Email</Label>
                                <Input
                                  type="email"
                                  value={selectedGuest.email || ''}
                                  onChange={(e) => setGuests((prev) => prev.map((guest) => guest.id === selectedGuest.id ? { ...guest, email: e.target.value || null } : guest))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input
                                  value={selectedGuest.phone || ''}
                                  onChange={(e) => setGuests((prev) => prev.map((guest) => guest.id === selectedGuest.id ? { ...guest, phone: e.target.value || null } : guest))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Group</Label>
                                <Select
                                  value={selectedGuest.group_name || '__none__'}
                                  onValueChange={(value) => setGuests((prev) => prev.map((guest) => guest.id === selectedGuest.id ? { ...guest, group_name: value === '__none__' ? null : value } : guest))}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">No group yet</SelectItem>
                                    {GUEST_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Category</Label>
                                <Select
                                  value={selectedGuest.category || 'general'}
                                  onValueChange={(value) => setGuests((prev) => prev.map((guest) => guest.id === selectedGuest.id ? { ...guest, category: value } : guest))}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {GUEST_CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Meal Preference</Label>
                                <Input
                                  value={selectedGuest.meal_preference || ''}
                                  onChange={(e) => setGuests((prev) => prev.map((guest) => guest.id === selectedGuest.id ? { ...guest, meal_preference: e.target.value || null } : guest))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Plus One</Label>
                                <Select
                                  value={selectedGuest.plus_one ? 'yes' : 'no'}
                                  onValueChange={(value) => setGuests((prev) => prev.map((guest) => guest.id === selectedGuest.id ? { ...guest, plus_one: value === 'yes' } : guest))}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="no">No</SelectItem>
                                    <SelectItem value="yes">Yes</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <div className="mt-4 flex justify-end">
                              <Button
                                type="button"
                                className="gap-2"
                                onClick={() =>
                                  saveGuestDetails(selectedGuest, {
                                    name: selectedGuest.name,
                                    email: selectedGuest.email,
                                    phone: selectedGuest.phone,
                                    group_name: selectedGuest.group_name,
                                    category: selectedGuest.category,
                                    meal_preference: selectedGuest.meal_preference,
                                    plus_one: selectedGuest.plus_one,
                                  } as Partial<Guest>)
                                }
                                disabled={savingGuestId === selectedGuest.id}
                              >
                                {savingGuestId === selectedGuest.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Save Guest
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-2xl border border-border/70 bg-background p-4">
                            <p className="text-sm font-medium text-foreground">RSVP and invite actions</p>
                            <p className="mt-1 text-sm text-muted-foreground">Update status, then send or copy the invite.</p>

                            <div className="mt-4 space-y-3">
                              <div className="space-y-2">
                                <Label>RSVP Status</Label>
                                <Select
                                  value={selectedGuest.rsvp_status || 'pending'}
                                  onValueChange={(value) => void updateRsvp(selectedGuest.id, value)}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="confirmed">Confirmed</SelectItem>
                                    <SelectItem value="declined">Declined</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-2">
                                <Button variant="outline" className="gap-2" onClick={() => copyRsvpLink(selectedGuest)}>
                                  <Copy className="h-4 w-4" />
                                  Copy RSVP Link
                                </Button>
                                <Button
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => openCompose(selectedGuest)}
                                  disabled={!selectedGuest.email}
                                >
                                  <Mail className="h-4 w-4" />
                                  Send Invite
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                            <p className="text-sm font-medium text-foreground">Guest readiness</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {!selectedGuest.email && !selectedGuest.phone
                                ? 'This guest still needs at least one contact method before outreach gets easier.'
                                : selectedGuest.rsvp_status === 'pending'
                                  ? 'This guest is ready for follow-up. Send the RSVP link and keep them moving toward a response.'
                                  : selectedGuest.rsvp_status === 'confirmed'
                                    ? 'This guest is confirmed. You can now use group, meal, and plus-one details for seating and service planning.'
                                    : 'This guest has declined, so the slot is no longer part of the active headcount.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[420px] items-center justify-center p-8">
                      <div className="max-w-md text-center">
                        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                        <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">No guest selected</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Pick a guest to manage details and RSVP actions.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Compose Invite Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {composeGuest ? `Send Invite to ${composeGuest.name}` : `Compose Bulk Invite (${pendingWithEmail.length} guests)`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Subject Line (optional)</Label>
              <Input
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                placeholder={`You're Invited${coupleName ? ` — ${coupleName}'s Wedding` : ' to Our Wedding'}!`}
              />
            </div>
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Label>Message Format</Label>
                <Tabs value={composeMode} onValueChange={(v) => setComposeMode(v as 'text' | 'html')}>
                  <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                    <TabsTrigger value="text">Text</TabsTrigger>
                    <TabsTrigger value="html">HTML</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <Textarea
                value={contentText}
                onChange={e => setContentText(e.target.value)}
                placeholder="We'd love for you to join us..."
                rows={4} className="resize-none"
              />
              <AnimatePresence>
                {composeMode === 'html' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                    <Label className="text-xs text-muted-foreground">Custom HTML</Label>
                    <Textarea value={contentHtml} onChange={e => setContentHtml(e.target.value)} placeholder="<h1>You're Invited!</h1>" rows={6} className="resize-none font-mono text-xs" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-2">
              {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreview ? 'Hide Preview' : 'Preview'}
            </Button>
            <AnimatePresence>
              {showPreview && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden rounded-xl border border-border p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Email Preview</p>
                  <h3 className="text-lg font-semibold text-foreground">
                    {composeSubject || `You're Invited${coupleName ? ` — ${coupleName}'s Wedding` : ' to Our Wedding'}!`}
                  </h3>
                  <div className="mt-3 border-t border-border pt-4">
                    {composeMode === 'html' && contentHtml.trim() ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: contentHtml }} />
                    ) : (
                      <div className="space-y-3 text-sm text-foreground">
                        <p>Dear <strong>{composeGuest?.name || '{Guest Name}'}</strong>,</p>
                        <p>We are delighted to invite you to celebrate our wedding{coupleName ? ` — ${coupleName}` : ''}.</p>
                        {profile?.wedding_date && <p>📅 <strong>Date:</strong> {new Date(profile.wedding_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>}
                        {profile?.wedding_location && <p>📍 <strong>Venue:</strong> {profile.wedding_location}</p>}
                        {contentText && <p className="border-l-2 border-primary pl-3 italic text-muted-foreground">{contentText}</p>}
                        <p>We would be honoured to have you join us.</p>
                        <p className="text-xs text-muted-foreground mt-4">📩 Each invite includes a personal RSVP link.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {sending && progress.total > 1 && (
              <div className="space-y-2">
                <Progress value={((progress.sent + progress.failed) / progress.total) * 100} />
                <p className="text-xs text-muted-foreground text-center">
                  Sending {progress.sent + progress.failed}/{progress.total}...
                </p>
              </div>
            )}
            <Button className="w-full gap-2" onClick={handleSend} disabled={sending}>
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending {progress.sent}/{progress.total}...</> : <><Send className="h-4 w-4" /> {composeGuest ? 'Send Invitation' : `Send to ${pendingWithEmail.length} Guests`}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradePromptDialog
        open={upgradePromptOpen}
        onOpenChange={setUpgradePromptOpen}
        decision={guestRsvpDecision}
      />
    </div>
  );
}
