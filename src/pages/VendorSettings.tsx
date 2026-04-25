import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Clock, Store, X, Instagram, Facebook, ShieldCheck, TrendingUp, AlertTriangle, CreditCard, LockKeyhole, Eye, Globe, Mail, MapPin, Phone, ExternalLink } from 'lucide-react';
import { getVendorReputationOverview, type VendorReputationOverview } from '@/lib/vendorReputation';
import { vendorAccessMessage, vendorHasActiveSubscription, vendorHasFullAccess } from '@/lib/vendorAccess';
import KenyaLocationFields from '@/components/KenyaLocationFields';
import { kenyaCounties, travelScopeOptions, formatBudgetBand, buildKenyaLocationLabel } from '@/lib/kenyaLocations';

const vendorCategories = ['Venue', 'Catering', 'Photography', 'Videography', 'Flowers', 'Music/DJ', 'Décor', 'Transport', 'MC', 'Cake', 'Other'];

interface VendorListing {
  id: string;
  logo_url: string | null;
  business_name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  location: string;
  services: string[];
  is_approved: boolean;
  is_verified: boolean;
  verification_requested: boolean;
  verification_requested_at: string | null;
  subscription_status: 'inactive' | 'active' | 'past_due' | 'cancelled';
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  social_instagram: string | null;
  social_facebook: string | null;
  social_tiktok: string | null;
  social_twitter: string | null;
  location_county: string | null;
  location_town: string | null;
  service_areas: string[];
  travel_scope: 'local_only' | 'selected_counties' | 'nationwide';
  minimum_budget_kes: number | null;
  maximum_budget_kes: number | null;
}

function normalizeExternalUrl(value: string) {
  if (!value.trim()) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function displayUrl(value: string) {
  return value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function XSocialIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.9 2H22l-6.77 7.73L23.2 22h-6.24l-4.9-7.42L5.56 22H2.44l7.24-8.27L1.8 2h6.4l4.43 6.8L18.9 2Zm-1.1 18h1.73L7.24 3.9H5.38L17.8 20Z" />
    </svg>
  );
}

function TikTokSocialIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M14.5 2c.33 1.93 1.49 3.79 3.35 4.8 1.06.58 2.16.83 3.15.86v3.09c-1.38-.05-2.77-.39-4.04-1.05a8.94 8.94 0 0 1-1.58-1.05v6.23c0 3.62-2.87 6.55-6.42 6.55a6.35 6.35 0 0 1-5.57-3.31 6.64 6.64 0 0 1-.8-3.24c0-3.62 2.87-6.55 6.42-6.55.29 0 .57.02.85.06v3.18a3.32 3.32 0 0 0-.85-.11c-1.8 0-3.27 1.49-3.27 3.33 0 1.24.66 2.32 1.64 2.9.48.29 1.04.44 1.63.44 1.76 0 3.2-1.43 3.27-3.2L12.4 2h2.1Z" />
    </svg>
  );
}

export default function VendorSettings() {
  const { user, isSuperAdmin, rolePreview } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listing, setListing] = useState<VendorListing | null>(null);
  const [form, setForm] = useState({
    business_name: '',
    category: 'Photography',
    description: '',
    phone: '',
    email: '',
    website: '',
    location: '',
    location_county: '',
    location_town: '',
    services: [] as string[],
    social_instagram: '',
    social_facebook: '',
    social_tiktok: '',
    social_twitter: '',
    service_areas: [] as string[],
    travel_scope: 'selected_counties' as const,
    minimum_budget_kes: '',
    maximum_budget_kes: '',
  });
  const [newService, setNewService] = useState('');
  const [serviceAreaDraft, setServiceAreaDraft] = useState('');
  const [reputationLoading, setReputationLoading] = useState(false);
  const [reputationOverview, setReputationOverview] = useState<VendorReputationOverview | null>(null);
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const vendorPreviewMode = isSuperAdmin && rolePreview === 'vendor';

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('vendor_listings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setListing(data as any);
        setForm({
          business_name: data.business_name || '',
          category: data.category || 'Photography',
          description: data.description || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          location: data.location || '',
          location_county: (data as any).location_county || '',
          location_town: (data as any).location_town || '',
          services: (data.services as string[]) || [],
          social_instagram: (data as any).social_instagram || '',
          social_facebook: (data as any).social_facebook || '',
          social_tiktok: (data as any).social_tiktok || '',
          social_twitter: (data as any).social_twitter || '',
          service_areas: ((data as any).service_areas as string[]) || [],
          travel_scope: ((data as any).travel_scope as VendorListing['travel_scope']) || 'selected_counties',
          minimum_budget_kes: (data as any).minimum_budget_kes != null ? String((data as any).minimum_budget_kes) : '',
          maximum_budget_kes: (data as any).maximum_budget_kes != null ? String((data as any).maximum_budget_kes) : '',
        });
      }
      setLoading(false);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (!listing?.id || !vendorHasFullAccess(listing)) {
      setReputationOverview(null);
      return;
    }

    let active = true;
    const loadReputationOverview = async () => {
      setReputationLoading(true);
      try {
        const data = await getVendorReputationOverview(listing.id, 3);
        if (active) setReputationOverview(data);
      } catch {
        if (active) setReputationOverview(null);
      } finally {
        if (active) setReputationLoading(false);
      }
    };

    void loadReputationOverview();
    return () => {
      active = false;
    };
  }, [listing?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      business_name: form.business_name,
      category: form.category,
      description: form.description || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      location: buildKenyaLocationLabel(form.location_county, form.location_town),
      location_county: form.location_county || null,
      location_town: form.location_town || null,
      services: form.services,
      social_instagram: form.social_instagram || null,
      social_facebook: form.social_facebook || null,
      social_tiktok: form.social_tiktok || null,
      social_twitter: form.social_twitter || null,
      service_areas: form.service_areas,
      travel_scope: form.travel_scope,
      minimum_budget_kes: form.minimum_budget_kes ? Number(form.minimum_budget_kes) : null,
      maximum_budget_kes: form.maximum_budget_kes ? Number(form.maximum_budget_kes) : null,
    };

    let error;
    if (listing) {
      ({ error } = await supabase.from('vendor_listings').update(payload).eq('id', listing.id));
    } else {
      ({ error } = await supabase.from('vendor_listings').insert(payload));
    }

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Saved!', description: listing ? 'Listing updated.' : 'Listing submitted for review.' });
      // Reload
      const { data } = await supabase.from('vendor_listings').select('*').eq('user_id', user.id).maybeSingle();
      if (data) setListing(data as any);
    }
    setSaving(false);
  };

  const addService = () => {
    const s = newService.trim();
    if (s && !form.services.includes(s)) {
      setForm((f) => ({ ...f, services: [...f.services, s] }));
      setNewService('');
    }
  };

  const removeService = (s: string) => {
    setForm((f) => ({ ...f, services: f.services.filter((x) => x !== s) }));
  };

  const addServiceArea = () => {
    if (!serviceAreaDraft || form.service_areas.includes(serviceAreaDraft)) return;
    setForm((prev) => ({ ...prev, service_areas: [...prev.service_areas, serviceAreaDraft] }));
    setServiceAreaDraft('');
  };

  const removeServiceArea = (county: string) => {
    setForm((prev) => ({ ...prev, service_areas: prev.service_areas.filter((item) => item !== county) }));
  };

  const handleRequestVerification = async () => {
    setRequestingVerification(true);
    try {
      const { error } = await supabase.rpc('request_vendor_verification' as any);
      if (error) throw error;

      toast({
        title: 'Verification requested',
        description: 'Your verification request has been sent to the admin review queue.',
      });

      if (!user) return;
      const { data } = await supabase.from('vendor_listings').select('*').eq('user_id', user.id).maybeSingle();
      if (data) setListing(data as VendorListing);
    } catch (error: any) {
      toast({
        title: 'Verification request failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRequestingVerification(false);
    }
  };

  const subscriptionActive = vendorPreviewMode || vendorHasActiveSubscription(listing);
  const fullAccess = vendorPreviewMode || vendorHasFullAccess(listing);
  const verificationRequestOpen = Boolean(listing?.verification_requested);
  const previewLocation = buildKenyaLocationLabel(form.location_county, form.location_town);
  const previewBudgetBand = formatBudgetBand(
    form.minimum_budget_kes ? Number(form.minimum_budget_kes) : null,
    form.maximum_budget_kes ? Number(form.maximum_budget_kes) : null,
  );
  const previewPhoneHref = form.phone ? `tel:${form.phone.replace(/[^\d+]/g, '')}` : '';
  const previewEmailHref = form.email ? `mailto:${form.email}` : '';
  const previewWebsiteHref = form.website ? normalizeExternalUrl(form.website) : '';
  const previewSocialLinks = useMemo(
    () =>
      [
        { label: 'Instagram', value: form.social_instagram, href: normalizeExternalUrl(form.social_instagram), theme: 'from-pink-500/15 to-orange-500/10', icon: 'instagram' as const },
        { label: 'Facebook', value: form.social_facebook, href: normalizeExternalUrl(form.social_facebook), theme: 'from-blue-500/15 to-sky-500/10', icon: 'facebook' as const },
        { label: 'TikTok', value: form.social_tiktok, href: normalizeExternalUrl(form.social_tiktok), theme: 'from-slate-900/10 to-emerald-400/10', icon: 'tiktok' as const },
        { label: 'X (Twitter)', value: form.social_twitter, href: normalizeExternalUrl(form.social_twitter), theme: 'from-slate-950/10 to-slate-500/10', icon: 'x' as const },
      ].filter((item) => item.value.trim()),
    [form.social_facebook, form.social_instagram, form.social_tiktok, form.social_twitter],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">My Vendor Listing</h1>
        <p className="text-muted-foreground">Manage your business listing on the vendor directory.</p>
      </div>

      {vendorPreviewMode && !listing && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Admin preview is giving this account full vendor access for testing. Saving this form will create a real vendor
            listing tied to your email so you can test the full vendor journey with live data.
          </CardContent>
        </Card>
      )}

      {/* Status banner */}
      {listing && (
        <Card className={listing.is_approved ? 'border-primary/30 bg-primary/5' : 'border-yellow-500/30 bg-yellow-500/5'}>
          <CardContent className="flex items-center gap-3 py-4">
            {listing.is_approved ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Your listing is live {listing.is_verified && '& verified ✓'}
                  </p>
                  <p className="text-xs text-muted-foreground">Visible in the vendor directory.</p>
                </div>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-foreground">Pending Approval</p>
                  <p className="text-xs text-muted-foreground">Your listing is under review. You'll be notified once approved.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {listing && (
        <Card className={fullAccess ? 'border-primary/30 bg-primary/5' : 'border-border/70 bg-muted/20'}>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              {fullAccess ? <ShieldCheck className="h-5 w-5 text-primary" /> : <LockKeyhole className="h-5 w-5 text-primary" />}
              Vendor Access
            </CardTitle>
            <CardDescription>
              Full planner connections and vendor analytics unlock only after approval, active subscription, and verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={listing.is_approved ? 'secondary' : 'outline'}>
                {listing.is_approved ? 'Approved' : 'Approval pending'}
              </Badge>
              <Badge variant={subscriptionActive ? 'secondary' : 'outline'}>
                Subscription: {listing.subscription_status}
              </Badge>
              <Badge variant={listing.is_verified ? 'secondary' : 'outline'}>
                {listing.is_verified ? 'Verified' : verificationRequestOpen ? 'Verification requested' : 'Unverified'}
              </Badge>
            </div>

            <div className="rounded-lg border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Current access status</p>
              <p className="mt-1">{vendorAccessMessage(listing)}</p>
              {listing.subscription_expires_at && (
                <p className="mt-1 text-xs">
                  Subscription expiry: {new Date(listing.subscription_expires_at).toLocaleDateString()}
                </p>
              )}
              {listing.verification_requested_at && !listing.is_verified && (
                <p className="mt-1 text-xs">
                  Verification requested on {new Date(listing.verification_requested_at).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={handleRequestVerification}
                disabled={!listing.is_approved || !subscriptionActive || listing.is_verified || verificationRequestOpen || requestingVerification}
              >
                {requestingVerification ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {listing.is_verified ? 'Already Verified' : verificationRequestOpen ? 'Verification Requested' : 'Request Verification'}
              </Button>
              {!subscriptionActive && (
                <div className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <CreditCard className="h-4 w-4" />
                  Subscription must be activated by admin before verification can be requested.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {listing && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Vendor Trust Overview
            </CardTitle>
            <CardDescription>
              Planner reputation data from structured post-event scorecards. Only aggregate, threshold-safe data is shown here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!fullAccess ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-4 w-4" />
                  Trust metrics are locked
                </div>
                <p className="mt-2">
                  Planner connection requests, backend statistics, and trust benchmarks unlock only after active subscription and verification.
                </p>
              </div>
            ) : reputationLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading trust overview
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Planner Score</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {reputationOverview?.benchmark_visible && reputationOverview.average_overall_rating != null
                      ? `${reputationOverview.average_overall_rating.toFixed(1)}/5`
                      : 'Locked'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reputationOverview?.sample_size ?? 0} scorecards captured
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Hire Again</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {reputationOverview?.benchmark_visible && reputationOverview.hire_again_rate != null
                      ? `${Math.round(reputationOverview.hire_again_rate * 100)}%`
                      : 'Locked'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Share of planners who would book you again</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">On-Time Rate</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {reputationOverview?.benchmark_visible && reputationOverview.on_time_rate != null
                      ? `${Math.round(reputationOverview.on_time_rate * 100)}%`
                      : 'Locked'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Based on scorecards that rated delivery timing</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Issue Rate</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {reputationOverview?.benchmark_visible && reputationOverview.flagged_review_count != null
                      ? `${reputationOverview.flagged_review_count}`
                      : 'Locked'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Scorecards with flagged delivery or coordination issues</p>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Market position signal
              </div>
              <p className="mt-1">
                {reputationOverview?.benchmark_visible
                  ? 'Your planner trust metrics are visible because the minimum review threshold has been met.'
                  : 'Trust metrics unlock after at least 3 planner scorecards. Encourage excellent execution and repeat planner relationships to strengthen this score.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Business Details
          </CardTitle>
          <CardDescription>Fill in your business information. This will be shown in the public directory.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Sign-in Email</Label>
              <Input type="email" value={user?.email || ''} readOnly />
              <p className="text-xs text-muted-foreground">
                This is the email tied to this vendor account. It is separate from your public business email below.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Business Name *</Label>
                <Input
                  value={form.business_name}
                  onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                  placeholder="Your business name"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {vendorCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Tell couples and planners about your services…"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+254..." />
              </div>
              <div className="space-y-2">
                <Label>Public Business Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="business@example.com" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Website</Label>
                <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Displayed location</Label>
                <Input value={buildKenyaLocationLabel(form.location_county, form.location_town) || ''} readOnly placeholder="Choose county and town below" />
              </div>
            </div>

            <KenyaLocationFields
              county={form.location_county}
              town={form.location_town}
              onCountyChange={(value) => setForm((f) => ({ ...f, location_county: value }))}
              onTownChange={(value) => setForm((f) => ({ ...f, location_town: value }))}
              countyLabel="Primary county"
              townLabel="Town / area"
            />

            <div className="space-y-2">
              <Label>Services / Tags</Label>
              <div className="flex gap-2">
                <Input
                  value={newService}
                  onChange={(e) => setNewService(e.target.value)}
                  placeholder="e.g. Outdoor Weddings"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addService(); } }}
                />
                <Button type="button" variant="outline" onClick={addService}>Add</Button>
              </div>
              {form.services.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.services.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <button type="button" onClick={() => removeService(s)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-4">
              <div className="space-y-1">
                <Label>Service Areas & Budget Fit</Label>
                <p className="text-xs text-muted-foreground">
                  This helps couples find vendors near their wedding location and within budget.
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={serviceAreaDraft}
                  onChange={(e) => setServiceAreaDraft(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select county</option>
                  {kenyaCounties
                    .filter((county) => !form.service_areas.includes(county))
                    .map((county) => (
                      <option key={county} value={county}>{county}</option>
                    ))}
                </select>
                <Button type="button" variant="outline" onClick={addServiceArea} disabled={!serviceAreaDraft}>
                  Add
                </Button>
              </div>
              {form.service_areas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.service_areas.map((county) => (
                    <Badge key={county} variant="secondary" className="gap-1">
                      {county}
                      <button type="button" onClick={() => removeServiceArea(county)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Travel Scope</Label>
                  <select
                    value={form.travel_scope}
                    onChange={(e) => setForm((prev) => ({ ...prev, travel_scope: e.target.value as VendorListing['travel_scope'] }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {travelScopeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Job Budget (KES)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.minimum_budget_kes}
                    onChange={(e) => setForm((prev) => ({ ...prev, minimum_budget_kes: e.target.value }))}
                    placeholder="e.g. 60000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Maximum Job Budget (KES)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.maximum_budget_kes}
                    onChange={(e) => setForm((prev) => ({ ...prev, maximum_budget_kes: e.target.value }))}
                    placeholder="e.g. 300000"
                  />
                </div>
              </div>
              {formatBudgetBand(
                form.minimum_budget_kes ? Number(form.minimum_budget_kes) : null,
                form.maximum_budget_kes ? Number(form.maximum_budget_kes) : null,
              ) && (
                <p className="text-xs text-muted-foreground">
                  Public budget band: {formatBudgetBand(
                    form.minimum_budget_kes ? Number(form.minimum_budget_kes) : null,
                    form.maximum_budget_kes ? Number(form.maximum_budget_kes) : null,
                  )}
                </p>
              )}
            </div>

            {/* Social Media */}
            <div className="border-t border-border pt-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Social Media</h3>
                <p className="text-xs text-muted-foreground">Link your accounts so clients can find you online.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram</Label>
                  <Input value={form.social_instagram} onChange={(e) => setForm((f) => ({ ...f, social_instagram: e.target.value }))} placeholder="https://instagram.com/yourbusiness" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5" /> Facebook</Label>
                  <Input value={form.social_facebook} onChange={(e) => setForm((f) => ({ ...f, social_facebook: e.target.value }))} placeholder="https://facebook.com/yourbusiness" />
                </div>
                <div className="space-y-2">
                  <Label>TikTok</Label>
                  <Input value={form.social_tiktok} onChange={(e) => setForm((f) => ({ ...f, social_tiktok: e.target.value }))} placeholder="https://tiktok.com/@yourbusiness" />
                </div>
                <div className="space-y-2">
                  <Label>X (Twitter)</Label>
                  <Input value={form.social_twitter} onChange={(e) => setForm((f) => ({ ...f, social_twitter: e.target.value }))} placeholder="https://x.com/yourbusiness" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="w-full sm:w-auto">
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Listing
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle className="font-display flex items-center gap-2">
                      <Eye className="h-5 w-5 text-primary" />
                      Directory Listing Preview
                    </DialogTitle>
                    <DialogDescription>
                      This preview uses your current draft so you can see how couples will experience your listing before you save it.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6">
                    <div>
                      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Directory card</p>
                      <Card className="shadow-card">
                        <CardContent className="flex flex-col items-center p-6 text-center">
                          <div className="relative">
                            <Avatar className="h-16 w-16 border-2 border-border">
                              <AvatarImage src={listing?.logo_url ?? undefined} alt={form.business_name || 'Vendor preview'} />
                              <AvatarFallback className="bg-primary/10 text-lg text-primary">
                                {(form.business_name || 'VP').split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {(listing?.is_verified || vendorPreviewMode) && (
                              <CheckCircle2 className="absolute -bottom-1 -right-1 h-5 w-5 text-primary fill-background" />
                            )}
                          </div>
                          <h3 className="mt-4 font-display text-lg font-semibold text-card-foreground">
                            {form.business_name || 'Your business name'}
                          </h3>
                          <Badge variant="outline" className="mt-1 text-xs">{form.category}</Badge>
                          {previewLocation && (
                            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" /> {previewLocation}
                            </p>
                          )}
                          {previewBudgetBand && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Typical budget: {previewBudgetBand}
                            </p>
                          )}
                          {form.description && (
                            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{form.description}</p>
                          )}
                          {form.services.length > 0 && (
                            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                              {form.services.slice(0, 3).map((service) => (
                                <Badge key={service} variant="secondary" className="text-xs">{service}</Badge>
                              ))}
                              {form.services.length > 3 && (
                                <Badge variant="secondary" className="text-xs">+{form.services.length - 3}</Badge>
                              )}
                            </div>
                          )}
                          {(listing?.is_verified || vendorPreviewMode) && (
                            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                              <CheckCircle2 className="h-3 w-3" /> Verified Vendor
                            </span>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div>
                      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Expanded details</p>
                      <Card className="shadow-card">
                        <CardHeader>
                          <CardTitle className="font-display text-2xl">{form.business_name || 'Your business name'}</CardTitle>
                          <CardDescription>
                            {form.category} {previewLocation ? `· ${previewLocation}` : ''}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                          <div className="grid gap-3 sm:grid-cols-2">
                            {form.phone && (
                              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
                                <a
                                  href={previewPhoneHref}
                                  className="mt-2 flex items-center gap-2 text-sm text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                                >
                                  <Phone className="h-4 w-4 text-primary" />
                                  {form.phone}
                                </a>
                              </div>
                            )}
                            {form.email && (
                              <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                                <a
                                  href={previewEmailHref}
                                  className="mt-2 flex items-center gap-2 break-all text-sm text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                                >
                                  <Mail className="h-4 w-4 text-primary" />
                                  {form.email}
                                </a>
                              </div>
                            )}
                            {form.website && (
                              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 sm:col-span-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Website</p>
                                <a
                                  href={previewWebsiteHref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 flex items-center gap-2 break-all text-sm text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
                                >
                                  <Globe className="h-4 w-4 text-primary" />
                                  {displayUrl(previewWebsiteHref)}
                                </a>
                              </div>
                            )}
                          </div>

                          {form.description && (
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">About this vendor</p>
                              <p className="mt-2 text-sm leading-7 text-foreground/85">{form.description}</p>
                            </div>
                          )}

                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Service Areas</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {form.service_areas.length > 0 ? (
                                  form.service_areas.map((county) => (
                                    <Badge key={county} variant="secondary">{county}</Badge>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">No service areas added yet.</p>
                                )}
                              </div>
                              <p className="mt-3 text-sm text-muted-foreground">Travel scope: {travelScopeOptions.find((option) => option.value === form.travel_scope)?.label || form.travel_scope}</p>
                            </div>

                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget Fit</p>
                              <p className="mt-3 text-sm text-foreground">{previewBudgetBand || 'No public budget band added yet.'}</p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Couples use this to understand whether your pricing fits their wedding plan.
                              </p>
                            </div>
                          </div>

                          {form.services.length > 0 && (
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Services & tags</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {form.services.map((service) => (
                                  <Badge key={service} variant="secondary">{service}</Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {previewSocialLinks.length > 0 && (
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Social media</p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {previewSocialLinks.map((link) => (
                                  <a
                                    key={link.label}
                                    href={link.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`group flex items-center gap-3 rounded-xl border border-border/70 bg-gradient-to-r ${link.theme} p-3 text-sm text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm`}
                                  >
                                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-primary shadow-sm">
                                      {link.icon === 'instagram' && <Instagram className="h-4 w-4" />}
                                      {link.icon === 'facebook' && <Facebook className="h-4 w-4" />}
                                      {link.icon === 'tiktok' && <TikTokSocialIcon className="h-4 w-4" />}
                                      {link.icon === 'x' && <XSocialIcon className="h-4 w-4" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block font-medium text-foreground">{link.label}</span>
                                      <span className="block truncate text-xs text-muted-foreground group-hover:text-foreground/80">
                                        {displayUrl(link.href)}
                                      </span>
                                    </span>
                                    <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {listing ? 'Update Listing' : 'Submit for Review'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
