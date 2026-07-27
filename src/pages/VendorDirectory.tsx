import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Search,
  Star,
  Store,
} from 'lucide-react';

import BrandWordmark from '@/components/BrandWordmark';
import VendorInterestButton from '@/components/VendorInterestButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatBudgetBand, getBudgetFit, getLocationMatch, getTownsForCounty, kenyaCounties } from '@/lib/kenyaLocations';
import {
  findVendorCollection,
  matchesVendorCollection,
  vendorCollections,
} from '@/lib/vendorDirectoryCollections';
import { vendorCanCollaborate } from '@/lib/vendorAccess';
import { getVendorReputationOverview, type VendorReputationOverview } from '@/lib/vendorReputation';
import { DirectoryResultsSkeleton } from '@/components/AppLoadingSkeletons';
import { isProfessionalNetworkEnabled } from '@/lib/featureFlags';
import PublicSiteFooter from '@/components/PublicSiteFooter';
import {
  canonicalizeVendorCategory,
  vendorCategoriesMatch,
  vendorCategoryCatalog,
} from '@/lib/vendorCategories';

interface VendorListing {
  id: string;
  business_name: string;
  category: string;
  description: string | null;
  logo_url: string | null;
  location: string | null;
  location_county: string | null;
  location_town: string | null;
  service_areas: string[];
  travel_scope: string;
  minimum_budget_kes: number | null;
  maximum_budget_kes: number | null;
  services: string[] | null;
  is_verified: boolean;
  subscription_status: 'inactive' | 'active' | 'past_due' | 'cancelled';
  subscription_expires_at: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  profile_kind: 'claimed' | 'curated' | 'featured';
  public_listing_note: string | null;
  featured_rank: number;
}

interface PlannerRecommendation {
  vendor_listing_id: string;
  planner_public_name: string;
  planner_company_name: string | null;
  planner_is_founding: boolean;
  recommendation_note: string | null;
}

interface VendorNetworkSignalSummary {
  total: number;
  recommended: number;
  collaborators: number;
}

const emptySuggestionForm = {
  vendorName: '',
  category: 'Wedding Venue',
  instagramOrWebsite: '',
  location: '',
  recommendationReason: '',
};

function vendorProfileBadge(listing: VendorListing) {
  switch (listing.profile_kind) {
    case 'featured':
      return { label: 'Featured profile', tone: 'default' as const };
    case 'curated':
      return { label: 'Curated listing', tone: 'outline' as const };
    case 'claimed':
    default:
      return { label: 'Profile claimed', tone: 'secondary' as const };
  }
}

export default function VendorDirectory() {
  const { slug } = useParams<{ slug?: string }>();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const collection = useMemo(() => findVendorCollection(slug), [slug]);
  const [vendors, setVendors] = useState<VendorListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [locationCounty, setLocationCounty] = useState('all');
  const [locationTown, setLocationTown] = useState('all');
  const [requestStatuses, setRequestStatuses] = useState<Record<string, string>>({});
  const [vendorRatings, setVendorRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [trustLoading, setTrustLoading] = useState(false);
  const [vendorTrust, setVendorTrust] = useState<Record<string, VendorReputationOverview>>({});
  const [recommendationsByVendorId, setRecommendationsByVendorId] = useState<Record<string, PlannerRecommendation[]>>({});
  const [networkSignalsByVendorId, setNetworkSignalsByVendorId] = useState<Record<string, VendorNetworkSignalSummary>>({});
  const [weddingBudgetTotal, setWeddingBudgetTotal] = useState<number | null>(null);
  const [recommendDialogVendor, setRecommendDialogVendor] = useState<VendorListing | null>(null);
  const [recommendationNote, setRecommendationNote] = useState('');
  const [recommendSubmitting, setRecommendSubmitting] = useState(false);
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [suggestSubmitting, setSuggestSubmitting] = useState(false);
  const [suggestionForm, setSuggestionForm] = useState(emptySuggestionForm);
  const professionalNetworkEnabled = isProfessionalNetworkEnabled();

  const isFoundingPlanner = professionalNetworkEnabled && profile?.role === 'planner' && Boolean((profile as any)?.founding_planner_contributor);
  const canRecommendVendor = professionalNetworkEnabled && Boolean(user && (isFoundingPlanner || profile?.role === 'admin'));
  const showPlannerTrust = profile?.role === 'planner' || profile?.role === 'admin';

  useEffect(() => {
    const load = async () => {
      const [listingsRes, ratingsRes, recommendationsRes] = await Promise.all([
        supabase
          .from('vendor_listings')
          .select('id, business_name, category, description, logo_url, location, location_county, location_town, service_areas, travel_scope, minimum_budget_kes, maximum_budget_kes, services, is_verified, subscription_status, subscription_expires_at, phone, email, website, profile_kind, public_listing_note, featured_rank')
          .eq('is_approved', true)
          .eq('directory_opt_out', false)
          .order('featured_rank', { ascending: false })
          .order('is_verified', { ascending: false }),
        supabase
          .from('vendor_reviews')
          .select('vendor_listing_id, rating'),
        professionalNetworkEnabled
          ? supabase
              .from('vendor_planner_recommendations' as any)
              .select('vendor_listing_id, planner_public_name, planner_company_name, planner_is_founding, recommendation_note')
              .eq('active', true)
          : Promise.resolve({ data: [] }),
      ]);

      setVendors(((listingsRes.data as VendorListing[]) || []).map((listing) => ({
        ...listing,
        category: canonicalizeVendorCategory(listing.category),
      })));

      const ratingsMap: Record<string, { total: number; count: number }> = {};
      ((ratingsRes.data || []) as Array<{ vendor_listing_id: string; rating: number }>).forEach((rating) => {
        if (!ratingsMap[rating.vendor_listing_id]) ratingsMap[rating.vendor_listing_id] = { total: 0, count: 0 };
        ratingsMap[rating.vendor_listing_id].total += rating.rating;
        ratingsMap[rating.vendor_listing_id].count += 1;
      });
      const computedRatings: Record<string, { avg: number; count: number }> = {};
      Object.entries(ratingsMap).forEach(([id, { total, count }]) => {
        computedRatings[id] = { avg: total / count, count };
      });
      setVendorRatings(computedRatings);

      const groupedRecommendations =
        ((recommendationsRes.data as PlannerRecommendation[] | null) ?? []).reduce((summary, recommendation) => {
          summary[recommendation.vendor_listing_id] = [...(summary[recommendation.vendor_listing_id] ?? []), recommendation];
          return summary;
        }, {} as Record<string, PlannerRecommendation[]>);
      setRecommendationsByVendorId(groupedRecommendations);
      setLoading(false);
    };

    void load();
  }, []);

  useEffect(() => {
    if (!professionalNetworkEnabled) {
      setNetworkSignalsByVendorId({});
      return;
    }

    const loadNetworkSignals = async () => {
      const { data } = await (supabase as any)
        .from('professional_network_relationships')
        .select('target_vendor_listing_id, relationship_type')
        .eq('active', true)
        .eq('is_public', true)
        .not('target_vendor_listing_id', 'is', null);

      const grouped = ((data as Array<{ target_vendor_listing_id: string; relationship_type: string }> | null) ?? [])
        .reduce((summary, signal) => {
          const current = summary[signal.target_vendor_listing_id] ?? { total: 0, recommended: 0, collaborators: 0 };
          current.total += 1;
          if (signal.relationship_type === 'recommended' || signal.relationship_type === 'preferred_vendor') {
            current.recommended += 1;
          }
          if (signal.relationship_type === 'worked_with' || signal.relationship_type === 'trusted_collaborator') {
            current.collaborators += 1;
          }
          summary[signal.target_vendor_listing_id] = current;
          return summary;
        }, {} as Record<string, VendorNetworkSignalSummary>);

      setNetworkSignalsByVendorId(grouped);
    };

    void loadNetworkSignals();
  }, [professionalNetworkEnabled]);

  useEffect(() => {
    const isCouple = profile?.role === 'couple';
    const isCommittee = profile?.role === 'planner' && profile?.planner_type === 'committee';
    if (!user || (!isCouple && !isCommittee)) return;

    const loadBudgetTotal = async () => {
      const { data } = await supabase
        .from('budget_categories')
        .select('allocated')
        .eq('user_id', user.id)
        .eq('budget_scope', 'wedding');
      const total = (data || []).reduce((sum, item) => sum + Number(item.allocated || 0), 0);
      setWeddingBudgetTotal(total || null);
    };

    void loadBudgetTotal();
  }, [user, profile?.planner_type, profile?.role]);

  useEffect(() => {
    if (!showPlannerTrust || vendors.length === 0) {
      setVendorTrust({});
      return;
    }

    let active = true;
    const loadTrust = async () => {
      setTrustLoading(true);
      try {
        const results = await Promise.all(
          vendors.map(async (vendor) => [
            vendor.id,
            await getVendorReputationOverview(vendor.id, 3),
          ] as const),
        );
        if (!active) return;
        setVendorTrust(Object.fromEntries(results));
      } finally {
        if (active) setTrustLoading(false);
      }
    };

    void loadTrust();
    return () => {
      active = false;
    };
  }, [showPlannerTrust, vendors]);

  useEffect(() => {
    if (!user) return;
    const loadStatuses = async () => {
      const { data } = await supabase
        .from('vendor_connection_requests' as any)
        .select('vendor_listing_id, status')
        .eq('requester_user_id', user.id);
      if (!data) return;
      const next: Record<string, string> = {};
      (data as any[]).forEach((row) => {
        next[row.vendor_listing_id] = row.status;
      });
      setRequestStatuses(next);
    };
    void loadStatuses();
  }, [user]);

  const availableTowns = locationCounty === 'all' ? [] : getTownsForCounty(locationCounty);

  const filtered = useMemo(() => {
    return vendors
      .filter((vendor) => {
        if (collection && !matchesVendorCollection(vendor, collection)) return false;
        if (category !== 'All' && !vendorCategoriesMatch(vendor.category, category)) return false;
        if (locationCounty !== 'all') {
          const servesCounty =
            vendor.location_county?.toLowerCase() === locationCounty.toLowerCase()
            || vendor.service_areas?.some((area) => area.toLowerCase() === locationCounty.toLowerCase())
            || vendor.travel_scope === 'nationwide';
          if (!servesCounty) return false;
        }
        if (locationTown !== 'all' && vendor.location_town?.toLowerCase() !== locationTown.toLowerCase()) return false;
        if (!search.trim()) return true;
        const query = search.toLowerCase();
        return (
          vendor.business_name.toLowerCase().includes(query)
          || vendor.category.toLowerCase().includes(query)
          || vendor.location?.toLowerCase().includes(query)
          || vendor.services?.some((service) => service.toLowerCase().includes(query))
        );
      })
      .sort((left, right) => {
        const leftLocation = getLocationMatch({
          weddingCounty: profile?.wedding_county,
          weddingTown: profile?.wedding_town,
          primaryCounty: left.location_county,
          primaryTown: left.location_town,
          serviceAreas: left.service_areas,
          travelScope: left.travel_scope,
        });
        const rightLocation = getLocationMatch({
          weddingCounty: profile?.wedding_county,
          weddingTown: profile?.wedding_town,
          primaryCounty: right.location_county,
          primaryTown: right.location_town,
          serviceAreas: right.service_areas,
          travelScope: right.travel_scope,
        });

        const leftBudget = getBudgetFit(weddingBudgetTotal, left.minimum_budget_kes, left.maximum_budget_kes);
        const rightBudget = getBudgetFit(weddingBudgetTotal, right.minimum_budget_kes, right.maximum_budget_kes);

        const leftRecommendationBoost = recommendationsByVendorId[left.id]?.some((item) => item.planner_is_founding) ? 2 : 0;
        const rightRecommendationBoost = recommendationsByVendorId[right.id]?.some((item) => item.planner_is_founding) ? 2 : 0;

        const scoreLeft = leftLocation.score + leftBudget.score + (left.is_verified ? 1 : 0) + leftRecommendationBoost + (left.profile_kind === 'featured' ? 2 : 0);
        const scoreRight = rightLocation.score + rightBudget.score + (right.is_verified ? 1 : 0) + rightRecommendationBoost + (right.profile_kind === 'featured' ? 2 : 0);

        if (scoreLeft !== scoreRight) return scoreRight - scoreLeft;
        return left.business_name.localeCompare(right.business_name);
      });
  }, [category, collection, locationCounty, locationTown, profile?.wedding_county, profile?.wedding_town, recommendationsByVendorId, search, vendors, weddingBudgetTotal]);

  const submitRecommendation = async () => {
    if (!user || !profile || !recommendDialogVendor) return;
    setRecommendSubmitting(true);
    const payload = {
      vendor_listing_id: recommendDialogVendor.id,
      planner_user_id: user.id,
      planner_public_name: profile.full_name || profile.company_name || 'Zania planner',
      planner_company_name: profile.company_name || null,
      planner_is_founding: Boolean((profile as any)?.founding_planner_contributor),
      recommendation_note: recommendationNote.trim() || null,
      active: true,
    };

    const { error, data } = await supabase
      .from('vendor_planner_recommendations' as any)
      .upsert(payload, { onConflict: 'vendor_listing_id,planner_user_id' })
      .select('vendor_listing_id, planner_public_name, planner_company_name, planner_is_founding, recommendation_note')
      .single();

    setRecommendSubmitting(false);
    if (error) {
      toast({ title: 'Could not save recommendation', description: error.message, variant: 'destructive' });
      return;
    }

    setRecommendationsByVendorId((current) => ({
      ...current,
      [recommendDialogVendor.id]: [
        ...((current[recommendDialogVendor.id] ?? []).filter((item) => item.planner_public_name !== payload.planner_public_name)),
        data as PlannerRecommendation,
      ],
    }));
    setRecommendationNote('');
    setRecommendDialogVendor(null);
    toast({
      title: 'Recommendation saved',
      description: `${recommendDialogVendor.business_name} now carries your planner recommendation.`,
    });
  };

  const submitVendorSuggestion = async () => {
    if (!user || !profile) {
      toast({ title: 'Sign in first', description: 'Vendor suggestions are tracked against your account so the curation queue stays clean.', variant: 'destructive' });
      return;
    }
    if (!suggestionForm.vendorName.trim() || !suggestionForm.recommendationReason.trim()) {
      toast({ title: 'Complete the suggestion', description: 'Add the vendor name and why you recommend them before sending.', variant: 'destructive' });
      return;
    }

    setSuggestSubmitting(true);
    const { error } = await supabase
      .from('vendor_suggestions' as any)
      .insert({
        suggested_by_user_id: user.id,
        suggester_role: profile.role,
        vendor_name: suggestionForm.vendorName.trim(),
        category: suggestionForm.category,
        instagram_or_website: suggestionForm.instagramOrWebsite.trim() || null,
        location: suggestionForm.location.trim() || null,
        recommendation_reason: suggestionForm.recommendationReason.trim(),
      });

    setSuggestSubmitting(false);
    if (error) {
      toast({ title: 'Could not submit vendor suggestion', description: error.message, variant: 'destructive' });
      return;
    }

    setSuggestionForm(emptySuggestionForm);
    setSuggestDialogOpen(false);
    toast({
      title: 'Suggestion received',
      description: 'We added that vendor to the curation queue for review.',
    });
  };

  const headerTitle = collection?.title ?? 'Vendor Directory';
  const headerDescription = collection?.description ?? 'Discover verified, curated, and claimed wedding vendors across Kenya. Browse by category, place, and recommendation trust.';

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <BrandWordmark size="sm" className="shrink-0" />
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Home
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => setSuggestDialogOpen(true)}>
            Suggest a Vendor
          </Button>
          {!user && (
            <Link to="/sign-in">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </nav>

      <section className="bg-gradient-warm px-4 py-12 text-center sm:px-6 sm:py-16">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="marketing-h2 text-foreground"
        >
          <Store className="mr-2 inline h-8 w-8 text-primary" />
          {headerTitle}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-auto mt-3 max-w-2xl text-muted-foreground"
        >
          {headerDescription}
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-auto mt-8 flex max-w-5xl flex-col gap-3 lg:flex-row"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search vendors…" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-10" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All categories</SelectItem>
              {vendorCategoryCatalog.map((item) => (
                <SelectItem key={item.name} value={item.name}>
                  {item.name} · {item.scope === 'personal' ? 'Personal' : 'Wedding'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={locationCounty}
            onValueChange={(value) => {
              setLocationCounty(value);
              setLocationTown('all');
            }}
          >
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue placeholder="All counties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All counties</SelectItem>
              {kenyaCounties.map((county) => (
                <SelectItem key={county} value={county}>{county}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={locationTown} onValueChange={setLocationTown} disabled={locationCounty === 'all'}>
            <SelectTrigger className="w-full lg:w-40">
              <SelectValue placeholder="All towns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All towns</SelectItem>
              {availableTowns.map((town) => (
                <SelectItem key={town} value={town}>{town}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      </section>

      {!collection && (
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">Public collections</p>
              <h2 className="marketing-h3 mt-2 text-foreground">Browse vendor collections couples can actually share</h2>
            </div>
            <Badge variant="outline" className="hidden md:inline-flex">Built for Google, browsing, and social proof</Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vendorCollections.map((item) => (
              <Link key={item.slug} to={`/vendors-directory/collections/${item.slug}`}>
                <Card className="h-full border-border/70 transition-shadow hover:shadow-warm">
                  <CardHeader>
                    <CardTitle className="marketing-h4">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        {loading ? (
          <DirectoryResultsSkeleton />
        ) : slug && !collection ? (
          <p className="py-20 text-center text-muted-foreground">That collection page does not exist yet.</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
            <p className="text-muted-foreground">
              {search || category !== 'All' || locationCounty !== 'all' || locationTown !== 'all' || collection
                ? 'No vendors match this directory view yet.'
                : 'No vendors listed yet.'}
            </p>
            <Button className="mt-4" variant="outline" onClick={() => setSuggestDialogOpen(true)}>
              Suggest a Vendor
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((vendor, index) => {
              const locationMatch = getLocationMatch({
                weddingCounty: profile?.wedding_county,
                weddingTown: profile?.wedding_town,
                primaryCounty: vendor.location_county,
                primaryTown: vendor.location_town,
                serviceAreas: vendor.service_areas,
                travelScope: vendor.travel_scope,
              });
              const budgetFit = getBudgetFit(weddingBudgetTotal, vendor.minimum_budget_kes, vendor.maximum_budget_kes);
              const matchReasons = [...locationMatch.reasons];
              if (budgetFit.label) matchReasons.push(budgetFit.label);
              const uniqueReasons = [...new Set(matchReasons)];
              const profileBadge = vendorProfileBadge(vendor);
              const foundingRecommendation = recommendationsByVendorId[vendor.id]?.find((item) => item.planner_is_founding);
              const networkSignals = networkSignalsByVendorId[vendor.id];

              return (
                <motion.div
                  key={vendor.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="group h-full shadow-card">
                    <CardContent className="flex h-full flex-col p-6">
                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          <Avatar className="h-16 w-16 border-2 border-border">
                            {vendor.logo_url ? <AvatarImage src={vendor.logo_url} alt={vendor.business_name} /> : null}
                            <AvatarFallback className="bg-primary/10 text-lg text-primary">
                              {vendor.business_name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {vendor.is_verified && (
                            <CheckCircle2 className="absolute -bottom-1 -right-1 h-5 w-5 fill-background text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-lg font-semibold text-card-foreground">{vendor.business_name}</h3>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">{vendor.category}</Badge>
                            <Badge variant={profileBadge.tone} className="text-xs">{profileBadge.label}</Badge>
                            {vendor.is_verified && <Badge className="text-xs">Verified by vendor</Badge>}
                          </div>
                        </div>
                      </div>

                      {foundingRecommendation && (
                        <div className="mt-4 rounded-2xl border border-[#ead8a8] bg-[#fff7e6] px-4 py-3 text-left">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a5b30]">
                            Recommended by a Zania Founding Planner
                          </p>
                          <p className="mt-1 text-sm font-medium text-[#4c3528]">
                            {foundingRecommendation.planner_company_name || foundingRecommendation.planner_public_name}
                          </p>
                          {foundingRecommendation.recommendation_note && (
                            <p className="mt-1 text-sm text-[#6a5142]">{foundingRecommendation.recommendation_note}</p>
                          )}
                        </div>
                      )}

                      {vendor.location && (
                        <p className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {vendor.location}
                        </p>
                      )}
                      {uniqueReasons.length > 0 && (
                        <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-left">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Why this match</p>
                          <p className="mt-1 text-xs text-foreground">{uniqueReasons.join(' · ')}</p>
                        </div>
                      )}
                      {formatBudgetBand(vendor.minimum_budget_kes, vendor.maximum_budget_kes) && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Typical budget: {formatBudgetBand(vendor.minimum_budget_kes, vendor.maximum_budget_kes)}
                        </p>
                      )}
                      {vendor.description && (
                        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{vendor.description}</p>
                      )}
                      {networkSignals && (
                        <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-left">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Network credibility</p>
                          <p className="mt-1 text-xs text-foreground">
                            {networkSignals.total} public signal{networkSignals.total === 1 ? '' : 's'}
                            {networkSignals.recommended > 0 ? ` · ${networkSignals.recommended} recommendation${networkSignals.recommended === 1 ? '' : 's'}` : ''}
                            {networkSignals.collaborators > 0 ? ` · ${networkSignals.collaborators} collaborator mark${networkSignals.collaborators === 1 ? '' : 's'}` : ''}
                          </p>
                        </div>
                      )}
                      {vendor.profile_kind === 'curated' && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          {vendor.public_listing_note || 'Listed from public business information and Zania curation.'}
                        </p>
                      )}
                      {vendor.services && vendor.services.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {vendor.services.slice(0, 4).map((service) => (
                            <Badge key={service} variant="secondary" className="text-xs">{service}</Badge>
                          ))}
                          {vendor.services.length > 4 && <Badge variant="secondary" className="text-xs">+{vendor.services.length - 4}</Badge>}
                        </div>
                      )}

                      {vendorRatings[vendor.id] && (
                        <div className="mt-4 flex items-center gap-1.5">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((step) => (
                              <Star
                                key={step}
                                className={`h-3.5 w-3.5 ${step <= Math.round(vendorRatings[vendor.id].avg) ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`}
                              />
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-foreground">{vendorRatings[vendor.id].avg.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({vendorRatings[vendor.id].count})</span>
                        </div>
                      )}

                      {showPlannerTrust && (
                        <div className="mt-4 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planner trust</span>
                            <Badge variant="outline" className="text-[10px]">{vendorTrust[vendor.id]?.sample_size ?? 0} reviews</Badge>
                          </div>
                          {trustLoading && !vendorTrust[vendor.id] ? (
                            <p className="mt-2 text-xs text-muted-foreground">Loading trust signal…</p>
                          ) : vendorTrust[vendor.id]?.benchmark_visible && vendorTrust[vendor.id]?.average_overall_rating != null ? (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm font-semibold text-foreground">{vendorTrust[vendor.id].average_overall_rating.toFixed(1)}/5 planner score</p>
                              <p className="text-xs text-muted-foreground">
                                {vendorTrust[vendor.id].hire_again_rate != null ? `${Math.round(vendorTrust[vendor.id].hire_again_rate * 100)}% would hire again` : 'Hire-again rate pending'}
                                {vendorTrust[vendor.id].on_time_rate != null ? ` · ${Math.round(vendorTrust[vendor.id].on_time_rate * 100)}% on time` : ''}
                              </p>
                            </div>
                          ) : vendorTrust[vendor.id]?.sample_size ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {vendorTrust[vendor.id].sample_size} scorecards captured. Benchmark unlocks at 3 reviews.
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-muted-foreground">No planner trust scorecards yet for this vendor.</p>
                          )}
                        </div>
                      )}

                      <div className="mt-auto pt-5">
                        <Link to={`/vendor/${vendor.id}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            View profile
                          </Button>
                        </Link>
                        {user && vendorCanCollaborate(vendor) && (
                          <VendorInterestButton
                            vendorListingId={vendor.id}
                            vendorName={vendor.business_name}
                            vendorEmail={vendor.email}
                            existingStatus={requestStatuses[vendor.id] || null}
                          />
                        )}
                        {user && !vendorCanCollaborate(vendor) && profile?.role !== 'vendor' && (
                          <p className="text-xs text-muted-foreground">
                            Connections unlock after this vendor is approved and verified.
                          </p>
                        )}
                        {canRecommendVendor && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-3 px-0 text-primary hover:bg-transparent hover:text-primary/80"
                            onClick={() => setRecommendDialogVendor(vendor)}
                          >
                            Recommend this vendor
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="marketing-h3">Suggest a Vendor</DialogTitle>
            <DialogDescription>
              Help Zania grow the directory with vendors you already trust.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-name">Vendor name</Label>
              <Input
                id="vendor-name"
                value={suggestionForm.vendorName}
                onChange={(event) => setSuggestionForm((current) => ({ ...current, vendorName: event.target.value }))}
                placeholder="e.g. Studio Arc Photography"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-category">Category</Label>
              <Select
                value={suggestionForm.category}
                onValueChange={(value) => setSuggestionForm((current) => ({ ...current, category: value }))}
              >
                <SelectTrigger id="vendor-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vendorCategoryCatalog.map((item) => (
                    <SelectItem key={item.name} value={item.name}>
                      {item.name} · {item.scope === 'personal' ? 'Personal' : 'Wedding'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-link">Instagram / website</Label>
              <Input
                id="vendor-link"
                value={suggestionForm.instagramOrWebsite}
                onChange={(event) => setSuggestionForm((current) => ({ ...current, instagramOrWebsite: event.target.value }))}
                placeholder="@vendorhandle or https://vendor.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-location">Location</Label>
              <Input
                id="vendor-location"
                value={suggestionForm.location}
                onChange={(event) => setSuggestionForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="Nairobi, Naivasha, Diani..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-reason">Why do you recommend them?</Label>
              <Textarea
                id="vendor-reason"
                value={suggestionForm.recommendationReason}
                onChange={(event) => setSuggestionForm((current) => ({ ...current, recommendationReason: event.target.value }))}
                placeholder="Tell us what makes them trustworthy, distinctive, or worth listing."
                rows={4}
              />
            </div>
            <Button className="w-full" onClick={submitVendorSuggestion} disabled={suggestSubmitting}>
              {suggestSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send suggestion
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(recommendDialogVendor)} onOpenChange={(open) => !open && setRecommendDialogVendor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="marketing-h3">Recommend {recommendDialogVendor?.business_name}</DialogTitle>
            <DialogDescription>
              This adds your public Zania recommendation to the vendor profile. Founding planner recommendations show up as trust signals for couples.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              {isFoundingPlanner
                ? 'This vendor will appear as recommended by a Zania Founding Planner.'
                : 'This recommendation will appear as a public Zania planner endorsement.'}
            </div>
            <div className="space-y-2">
              <Label htmlFor="recommendation-note">Why do you recommend them?</Label>
              <Textarea
                id="recommendation-note"
                value={recommendationNote}
                onChange={(event) => setRecommendationNote(event.target.value)}
                placeholder="Share a concise note couples can trust."
                rows={4}
              />
            </div>
            <Button className="w-full" onClick={submitRecommendation} disabled={recommendSubmitting}>
              {recommendSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save recommendation
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PublicSiteFooter />
    </div>
  );
}
