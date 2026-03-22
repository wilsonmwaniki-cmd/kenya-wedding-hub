import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Heart, Search, Loader2, Store, ArrowLeft, CheckCircle2, MapPin, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import VendorInterestButton from '@/components/VendorInterestButton';
import { getVendorReputationOverview, type VendorReputationOverview } from '@/lib/vendorReputation';
import { vendorHasFullAccess } from '@/lib/vendorAccess';
import { formatBudgetBand, getBudgetFit, getLocationMatch } from '@/lib/kenyaLocations';

const vendorCategories = ['All', 'Venue', 'Catering', 'Photography', 'Videography', 'Flowers', 'Music/DJ', 'Décor', 'Transport', 'MC', 'Cake', 'Other'];

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
}

export default function VendorDirectory() {
  const { user, profile } = useAuth();
  const [vendors, setVendors] = useState<VendorListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [requestStatuses, setRequestStatuses] = useState<Record<string, string>>({});
  const [vendorRatings, setVendorRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [trustLoading, setTrustLoading] = useState(false);
  const [vendorTrust, setVendorTrust] = useState<Record<string, VendorReputationOverview>>({});
  const [weddingBudgetTotal, setWeddingBudgetTotal] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const [listingsRes, ratingsRes] = await Promise.all([
        supabase
          .from('vendor_listings')
          .select('id, business_name, category, description, logo_url, location, location_county, location_town, service_areas, travel_scope, minimum_budget_kes, maximum_budget_kes, services, is_verified, subscription_status, subscription_expires_at, phone, email, website')
          .eq('is_approved', true)
          .order('is_verified', { ascending: false }),
        supabase
          .from('vendor_reviews')
          .select('vendor_listing_id, rating'),
      ]);
      setVendors((listingsRes.data as VendorListing[]) || []);

      // Aggregate ratings
      const ratingsMap: Record<string, { total: number; count: number }> = {};
      ((ratingsRes.data || []) as Array<{ vendor_listing_id: string; rating: number }>).forEach(r => {
        if (!ratingsMap[r.vendor_listing_id]) ratingsMap[r.vendor_listing_id] = { total: 0, count: 0 };
        ratingsMap[r.vendor_listing_id].total += r.rating;
        ratingsMap[r.vendor_listing_id].count += 1;
      });
      const computed: Record<string, { avg: number; count: number }> = {};
      Object.entries(ratingsMap).forEach(([id, { total, count }]) => {
        computed[id] = { avg: total / count, count };
      });
      setVendorRatings(computed);

      setLoading(false);
    };
    load();
  }, []);

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
  }, [user, profile?.role, profile?.planner_type]);

  useEffect(() => {
    const canSeeTrust = profile?.role === 'planner' || profile?.role === 'admin';
    if (!canSeeTrust || vendors.length === 0) {
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
      } catch (error) {
        if (!active) return;
        setVendorTrust({});
      } finally {
        if (active) setTrustLoading(false);
      }
    };

    void loadTrust();
    return () => {
      active = false;
    };
  }, [vendors, profile?.role]);

  // Load existing request statuses for logged-in user
  useEffect(() => {
    if (!user) return;
    const loadStatuses = async () => {
      const { data } = await supabase
        .from('vendor_connection_requests' as any)
        .select('vendor_listing_id, status')
        .eq('requester_user_id', user.id);
      if (data) {
        const map: Record<string, string> = {};
        (data as any[]).forEach((r: any) => { map[r.vendor_listing_id] = r.status; });
        setRequestStatuses(map);
      }
    };
    loadStatuses();
  }, [user]);

  const filtered = vendors.filter((v) => {
    if (category !== 'All' && v.category !== category) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.business_name.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.location?.toLowerCase().includes(q) ||
      v.services?.some((s) => s.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    const aLocation = getLocationMatch({
      weddingCounty: profile?.wedding_county,
      weddingTown: profile?.wedding_town,
      primaryCounty: a.location_county,
      primaryTown: a.location_town,
      serviceAreas: a.service_areas,
      travelScope: a.travel_scope,
    });
    const bLocation = getLocationMatch({
      weddingCounty: profile?.wedding_county,
      weddingTown: profile?.wedding_town,
      primaryCounty: b.location_county,
      primaryTown: b.location_town,
      serviceAreas: b.service_areas,
      travelScope: b.travel_scope,
    });

    const aBudget = getBudgetFit(weddingBudgetTotal, a.minimum_budget_kes, a.maximum_budget_kes);
    const bBudget = getBudgetFit(weddingBudgetTotal, b.minimum_budget_kes, b.maximum_budget_kes);

    const scoreA = aLocation.score + aBudget.score + (a.is_verified ? 1 : 0);
    const scoreB = bLocation.score + bBudget.score + (b.is_verified ? 1 : 0);

    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.business_name.localeCompare(b.business_name);
  });

  const showPlannerTrust = profile?.role === 'planner' || profile?.role === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between border-b border-border px-6 py-4 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" fill="currentColor" />
          <span className="font-display text-xl font-bold text-foreground">Zania</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Home
            </Button>
          </Link>
          {!user && (
            <Link to="/auth">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </nav>

      <section className="bg-gradient-warm px-6 py-16 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-3xl font-bold text-foreground sm:text-4xl"
        >
          <Store className="inline h-8 w-8 mr-2 text-primary" />
          Vendor Directory
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mx-auto mt-3 max-w-md text-muted-foreground"
        >
          Discover verified wedding vendors across Kenya. From venues to photographers, find the perfect team for your big day.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-auto mt-8 flex max-w-lg gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {vendorCategories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
        {showPlannerTrust && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground"
          >
            Planner trust data is visible. Private scorecards stay hidden until at least 3 reviews exist.
          </motion.p>
        )}
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">
            {search || category !== 'All' ? 'No vendors match your search.' : 'No vendors listed yet. Be the first!'}
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="group h-full shadow-card transition-shadow hover:shadow-warm">
                  <CardContent className="flex flex-col items-center p-6 text-center">
                    <div className="relative">
                      <Avatar className="h-16 w-16 border-2 border-border">
                        {v.logo_url ? (
                          <AvatarImage src={v.logo_url} alt={v.business_name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-lg text-primary">
                          {v.business_name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {v.is_verified && (
                        <CheckCircle2 className="absolute -bottom-1 -right-1 h-5 w-5 text-primary fill-background" />
                      )}
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold text-card-foreground">
                      {v.business_name}
                    </h3>
                    <Badge variant="outline" className="mt-1 text-xs">{v.category}</Badge>
                    {v.location && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {v.location}
                      </p>
                    )}
                    {profile?.wedding_county && (
                      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                        {getLocationMatch({
                          weddingCounty: profile.wedding_county,
                          weddingTown: profile.wedding_town,
                          primaryCounty: v.location_county,
                          primaryTown: v.location_town,
                          serviceAreas: v.service_areas,
                          travelScope: v.travel_scope,
                        }).reasons.map((reason) => (
                          <Badge key={reason} variant="outline" className="text-[10px]">{reason}</Badge>
                        ))}
                        {getBudgetFit(weddingBudgetTotal, v.minimum_budget_kes, v.maximum_budget_kes).label && (
                          <Badge variant="outline" className="text-[10px]">
                            {getBudgetFit(weddingBudgetTotal, v.minimum_budget_kes, v.maximum_budget_kes).label}
                          </Badge>
                        )}
                      </div>
                    )}
                    {formatBudgetBand(v.minimum_budget_kes, v.maximum_budget_kes) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Typical budget: {formatBudgetBand(v.minimum_budget_kes, v.maximum_budget_kes)}
                      </p>
                    )}
                    {v.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{v.description}</p>
                    )}
                    {v.services && v.services.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                        {v.services.slice(0, 3).map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                        {v.services.length > 3 && (
                          <Badge variant="secondary" className="text-xs">+{v.services.length - 3}</Badge>
                        )}
                      </div>
                    )}
                    {vendorRatings[v.id] && (
                      <div className="mt-2 flex items-center justify-center gap-1.5">
                        <div className="flex gap-0.5">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`h-3.5 w-3.5 ${s <= Math.round(vendorRatings[v.id].avg) ? 'text-accent fill-accent' : 'text-muted-foreground/30'}`} />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-foreground">{vendorRatings[v.id].avg.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">({vendorRatings[v.id].count})</span>
                      </div>
                    )}
                    {showPlannerTrust && (
                      <div className="mt-3 w-full rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planner trust</span>
                          <Badge variant="outline" className="text-[10px]">
                            {vendorTrust[v.id]?.sample_size ?? 0} reviews
                          </Badge>
                        </div>
                        {trustLoading && !vendorTrust[v.id] ? (
                          <p className="mt-2 text-xs text-muted-foreground">Loading trust signal…</p>
                        ) : vendorTrust[v.id]?.benchmark_visible && vendorTrust[v.id]?.average_overall_rating != null ? (
                          <div className="mt-2 space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                              {vendorTrust[v.id].average_overall_rating.toFixed(1)}/5 planner score
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {vendorTrust[v.id].hire_again_rate != null ? `${Math.round(vendorTrust[v.id].hire_again_rate * 100)}% would hire again` : 'Hire-again rate pending'}
                              {vendorTrust[v.id].on_time_rate != null ? ` · ${Math.round(vendorTrust[v.id].on_time_rate * 100)}% on time` : ''}
                            </p>
                          </div>
                        ) : vendorTrust[v.id]?.sample_size ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {vendorTrust[v.id].sample_size} scorecards captured. Benchmark unlocks at 3 reviews.
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            No planner trust scorecards yet for this vendor.
                          </p>
                        )}
                      </div>
                    )}
                    {v.is_verified && (
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <CheckCircle2 className="h-3 w-3" /> Verified Vendor
                      </span>
                    )}
                    {/* Interest button for logged-in couples/planners */}
                    {user && vendorHasFullAccess(v) && (
                      <div className="mt-4">
                        <VendorInterestButton
                          vendorListingId={v.id}
                          vendorName={v.business_name}
                          vendorEmail={v.email}
                          existingStatus={requestStatuses[v.id] || null}
                        />
                      </div>
                    )}
                    {user && !vendorHasFullAccess(v) && profile?.role !== 'vendor' && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Planner connections unlock after vendor verification and subscription.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <Heart className="h-4 w-4 text-primary" fill="currentColor" />
          <span>Zania © {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
