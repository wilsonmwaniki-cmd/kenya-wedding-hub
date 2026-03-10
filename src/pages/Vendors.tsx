import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Phone, Search, CheckCircle2, Loader2, Save, Sparkles, ShieldCheck, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { getVendorPriceBenchmark, type VendorPriceBenchmark } from '@/lib/vendorPriceIntelligence';
import {
  createVendorReputationReview,
  getVendorReputationBenchmark,
  listVendorReputationReviews,
  type VendorReputationBenchmark,
  type VendorReputationIssueFlag,
  type VendorReputationReview,
} from '@/lib/vendorReputation';

interface Vendor {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  price: number | null;
  status: string | null;
  notes: string | null;
  vendor_listing_id: string | null;
}

interface DirectoryVendor {
  id: string;
  business_name: string;
  category: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  is_verified: boolean;
}

const vendorCategories = ['Venue', 'Catering', 'Photography', 'Videography', 'Flowers', 'Music/DJ', 'Décor', 'Transport', 'MC', 'Cake', 'Other'];
const vendorStatuses = ['contacted', 'quoted', 'booked', 'completed', 'rejected'] as const;
const issueFlagOptions: Array<{ value: VendorReputationIssueFlag; label: string }> = [
  { value: 'late_setup', label: 'Late setup' },
  { value: 'late_delivery', label: 'Late delivery' },
  { value: 'poor_communication', label: 'Poor communication' },
  { value: 'deposit_risk', label: 'Deposit risk' },
  { value: 'quality_issue', label: 'Quality issue' },
  { value: 'no_show', label: 'No-show' },
  { value: 'scope_change', label: 'Scope change' },
  { value: 'budget_overrun', label: 'Budget overrun' },
  { value: 'unprofessional_staff', label: 'Unprofessional staff' },
  { value: 'payment_dispute', label: 'Payment dispute' },
];

function formatCurrency(value: number | null | undefined) {
  if (value == null) return 'N/A';
  return `KES ${Number(value).toLocaleString()}`;
}

function benchmarkKey(category: string) {
  return category.toLowerCase().trim();
}

function benchmarkSummary(benchmark?: VendorPriceBenchmark | null) {
  if (!benchmark) return 'Loading market data...';
  if (benchmark.benchmark_visible) {
    return `Median ${formatCurrency(benchmark.median_amount)} · Range ${formatCurrency(benchmark.minimum_amount)} - ${formatCurrency(benchmark.maximum_amount)}`;
  }
  if (benchmark.sample_size > 0) {
    return `${benchmark.sample_size} observations captured. Benchmarks unlock at 5 samples.`;
  }
  return 'No market observations captured yet for this segment.';
}

function reputationSummary(benchmark?: VendorReputationBenchmark | null) {
  if (!benchmark) return 'Loading planner trust data...';
  if (benchmark.benchmark_visible && benchmark.average_overall_rating != null) {
    const hireAgainRate = benchmark.hire_again_rate != null ? `${Math.round(benchmark.hire_again_rate * 100)}% would hire again` : 'Hire-again rate pending';
    return `Planner score ${benchmark.average_overall_rating.toFixed(1)}/5 · ${hireAgainRate}`;
  }
  if (benchmark.sample_size > 0) {
    return `${benchmark.sample_size} scorecards captured. Trust benchmarks unlock at 3 reviews.`;
  }
  return 'No planner scorecards captured yet for this vendor segment.';
}

function formatIssueFlags(issueFlags: string[]) {
  if (!issueFlags.length) return 'No flagged issues';
  return issueFlags
    .map((flag) => issueFlagOptions.find((option) => option.value === flag)?.label ?? flag)
    .join(', ');
}

export default function Vendors() {
  const { user } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'directory' | 'custom'>('directory');
  const [form, setForm] = useState({ name: '', category: 'Venue', phone: '', price: '' });
  const [dirSearch, setDirSearch] = useState('');
  const [dirResults, setDirResults] = useState<DirectoryVendor[]>([]);
  const [dirLoading, setDirLoading] = useState(false);
  const [benchmarksLoading, setBenchmarksLoading] = useState(false);
  const [categoryBenchmarks, setCategoryBenchmarks] = useState<Record<string, VendorPriceBenchmark>>({});
  const [listingBenchmarks, setListingBenchmarks] = useState<Record<string, VendorPriceBenchmark>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [modalBenchmark, setModalBenchmark] = useState<VendorPriceBenchmark | null>(null);
  const [modalBenchmarkLoading, setModalBenchmarkLoading] = useState(false);
  const [reputationBenchmarksLoading, setReputationBenchmarksLoading] = useState(false);
  const [categoryReputationBenchmarks, setCategoryReputationBenchmarks] = useState<Record<string, VendorReputationBenchmark>>({});
  const [listingReputationBenchmarks, setListingReputationBenchmarks] = useState<Record<string, VendorReputationBenchmark>>({});
  const [reviewsBySourceVendorId, setReviewsBySourceVendorId] = useState<Record<string, VendorReputationReview>>({});
  const [reviewDialogVendor, setReviewDialogVendor] = useState<Vendor | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    overallRating: '5',
    reliabilityRating: '5',
    communicationRating: '5',
    qualityRating: '5',
    punctualityRating: '5',
    valueRating: '5',
    deliveredOnTime: 'yes',
    wouldHireAgain: 'yes',
    visibility: 'planner_network',
    privateNotes: '',
    issueFlags: [] as VendorReputationIssueFlag[],
  });

  useEffect(() => {
    if (isPlanner && !selectedClient) navigate('/clients');
  }, [isPlanner, selectedClient, navigate]);

  const load = async () => {
    if (!dataOrFilter) return;
    const { data, error } = await supabase.from('vendors').select('*').or(dataOrFilter).order('created_at');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    const rows = (data ?? []).map((d) => ({ ...d, price: d.price ? Number(d.price) : null })) as Vendor[];
    setVendors(rows);
    setPriceDrafts(Object.fromEntries(rows.map((row) => [row.id, row.price != null ? String(row.price) : ''])));
  };

  useEffect(() => {
    void load();
  }, [user, selectedClient, dataOrFilter]);

  const loadBenchmarks = async (rows: Vendor[]) => {
    if (!rows.length) {
      setCategoryBenchmarks({});
      setListingBenchmarks({});
      return;
    }

    setBenchmarksLoading(true);
    try {
      const uniqueCategories = [...new Set(rows.map((row) => row.category).filter(Boolean))];
      const uniqueListingIds = [...new Set(rows.map((row) => row.vendor_listing_id).filter(Boolean))] as string[];

      const categoryResults = await Promise.all(
        uniqueCategories.map(async (category) => [
          benchmarkKey(category),
          await getVendorPriceBenchmark({
            category,
            venue: selectedClient?.wedding_location ?? null,
            minSampleSize: 5,
          }),
        ] as const),
      );

      const listingResults = await Promise.all(
        uniqueListingIds.map(async (listingId) => [
          listingId,
          await getVendorPriceBenchmark({
            vendorListingId: listingId,
            minSampleSize: 5,
          }),
        ] as const),
      );

      setCategoryBenchmarks(Object.fromEntries(categoryResults));
      setListingBenchmarks(Object.fromEntries(listingResults));
    } catch (error: any) {
      toast({
        title: 'Failed to load price benchmarks',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setBenchmarksLoading(false);
    }
  };

  useEffect(() => {
    void loadBenchmarks(vendors);
  }, [vendors, selectedClient?.wedding_location]);

  const loadReputationData = async (rows: Vendor[]) => {
    if (!rows.length) {
      setCategoryReputationBenchmarks({});
      setListingReputationBenchmarks({});
      setReviewsBySourceVendorId({});
      return;
    }

    setReputationBenchmarksLoading(true);
    try {
      const uniqueCategories = [...new Set(rows.map((row) => row.category).filter(Boolean))];
      const uniqueListingIds = [...new Set(rows.map((row) => row.vendor_listing_id).filter(Boolean))] as string[];

      const [reviews, categoryResults, listingResults] = await Promise.all([
        listVendorReputationReviews({
          clientId: selectedClient?.id ?? null,
          limit: 200,
        }),
        Promise.all(
          uniqueCategories.map(async (category) => [
            benchmarkKey(category),
            await getVendorReputationBenchmark({
              category,
              minSampleSize: 3,
            }),
          ] as const),
        ),
        Promise.all(
          uniqueListingIds.map(async (listingId) => [
            listingId,
            await getVendorReputationBenchmark({
              vendorListingId: listingId,
              minSampleSize: 3,
            }),
          ] as const),
        ),
      ]);

      setReviewsBySourceVendorId(
        Object.fromEntries(
          reviews
            .filter((review) => review.source_vendor_id)
            .map((review) => [review.source_vendor_id as string, review]),
        ),
      );
      setCategoryReputationBenchmarks(Object.fromEntries(categoryResults));
      setListingReputationBenchmarks(Object.fromEntries(listingResults));
    } catch (error: any) {
      toast({
        title: 'Failed to load vendor trust data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setReputationBenchmarksLoading(false);
    }
  };

  useEffect(() => {
    void loadReputationData(vendors);
  }, [vendors, selectedClient?.id]);

  useEffect(() => {
    if (!open || mode !== 'custom') return;

    let active = true;
    const run = async () => {
      setModalBenchmarkLoading(true);
      try {
        const result = await getVendorPriceBenchmark({
          category: form.category,
          venue: selectedClient?.wedding_location ?? null,
          minSampleSize: 5,
        });
        if (active) setModalBenchmark(result);
      } catch {
        if (active) setModalBenchmark(null);
      } finally {
        if (active) setModalBenchmarkLoading(false);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [open, mode, form.category, selectedClient?.wedding_location]);

  const searchDirectory = async (q: string) => {
    setDirSearch(q);
    if (q.trim().length < 2) {
      setDirResults([]);
      return;
    }

    setDirLoading(true);
    const { data } = await supabase
      .from('vendor_listings')
      .select('id, business_name, category, phone, email, location, is_verified')
      .eq('is_approved', true)
      .ilike('business_name', `%${q}%`)
      .limit(10);

    setDirResults((data as DirectoryVendor[]) || []);
    setDirLoading(false);
  };

  const addFromDirectory = async (dv: DirectoryVendor) => {
    if (!user) return;

    const insert: Record<string, unknown> = {
      user_id: user.id,
      name: dv.business_name,
      category: dv.category,
      phone: dv.phone || null,
      price: null,
      status: 'contacted',
      vendor_listing_id: dv.id,
    };

    if (isPlanner && selectedClient) insert.client_id = selectedClient.id;

    const { error } = await supabase.from('vendors').insert(insert);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Vendor added',
      description: `${dv.business_name} was added. Capture the quoted price on the card to feed market intelligence.`,
    });
    setOpen(false);
    setDirSearch('');
    setDirResults([]);
    await load();
  };

  const addVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const insert: Record<string, unknown> = {
      user_id: user.id,
      name: form.name,
      category: form.category,
      phone: form.phone || null,
      price: form.price ? parseFloat(form.price) : null,
      status: form.price ? 'quoted' : 'contacted',
    };

    if (isPlanner && selectedClient) insert.client_id = selectedClient.id;

    const { error } = await supabase.from('vendors').insert(insert);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    setForm({ name: '', category: 'Venue', phone: '', price: '' });
    setOpen(false);
    await load();
  };

  const updateStatus = async (id: string, status: string) => {
    setSavingStatusId(id);
    const { error } = await supabase.from('vendors').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      await load();
    }
    setSavingStatusId(null);
  };

  const updateVendorPrice = async (vendor: Vendor) => {
    const draft = priceDrafts[vendor.id]?.trim() ?? '';
    const nextPrice = draft === '' ? null : Number(draft);

    if (draft !== '' && (!Number.isFinite(nextPrice) || nextPrice <= 0)) {
      toast({
        title: 'Invalid price',
        description: 'Enter a valid KES amount greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    setSavingPriceId(vendor.id);
    const { error } = await supabase
      .from('vendors')
      .update({ price: nextPrice })
      .eq('id', vendor.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Price saved',
        description: nextPrice
          ? 'This vendor price now feeds your market pricing benchmarks.'
          : 'Vendor price cleared.',
      });
      await load();
    }
    setSavingPriceId(null);
  };

  const deleteVendor = async (id: string) => {
    await supabase.from('vendors').delete().eq('id', id);
    await load();
  };

  const resetReviewForm = () => {
    setReviewForm({
      overallRating: '5',
      reliabilityRating: '5',
      communicationRating: '5',
      qualityRating: '5',
      punctualityRating: '5',
      valueRating: '5',
      deliveredOnTime: 'yes',
      wouldHireAgain: 'yes',
      visibility: 'planner_network',
      privateNotes: '',
      issueFlags: [],
    });
  };

  const toggleIssueFlag = (flag: VendorReputationIssueFlag) => {
    setReviewForm((prev) => ({
      ...prev,
      issueFlags: prev.issueFlags.includes(flag)
        ? prev.issueFlags.filter((currentFlag) => currentFlag !== flag)
        : [...prev.issueFlags, flag],
    }));
  };

  const submitReview = async (vendor: Vendor) => {
    if (!selectedClient) return;

    setReviewSubmitting(true);
    try {
      await createVendorReputationReview({
        overallRating: Number(reviewForm.overallRating),
        reliabilityRating: Number(reviewForm.reliabilityRating),
        communicationRating: Number(reviewForm.communicationRating),
        qualityRating: Number(reviewForm.qualityRating),
        punctualityRating: Number(reviewForm.punctualityRating),
        valueRating: Number(reviewForm.valueRating),
        vendorName: vendor.name,
        vendorCategory: vendor.category,
        vendorListingId: vendor.vendor_listing_id,
        sourceVendorId: vendor.id,
        clientId: selectedClient.id,
        eventDate: selectedClient.wedding_date ?? null,
        deliveredOnTime: reviewForm.deliveredOnTime === 'yes',
        wouldHireAgain: reviewForm.wouldHireAgain === 'yes',
        issueFlags: reviewForm.issueFlags,
        privateNotes: reviewForm.privateNotes || null,
        visibility: reviewForm.visibility as 'private' | 'planner_network' | 'admin_only',
        isAnonymized: true,
      });

      toast({
        title: 'Vendor scorecard saved',
        description: 'Your planner review now feeds the vendor reputation graph.',
      });
      setReviewDialogVendor(null);
      resetReviewForm();
      await loadReputationData(vendors);
    } catch (error: any) {
      toast({
        title: 'Failed to save review',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const trackedCategoryBenchmarks = useMemo(() => {
    const categories = [...new Set(vendors.map((vendor) => vendor.category).filter(Boolean))];
    return categories
      .slice(0, 4)
      .map((category) => ({
        category,
        benchmark: categoryBenchmarks[benchmarkKey(category)],
      }));
  }, [vendors, categoryBenchmarks]);

  const trackedReputationBenchmarks = useMemo(() => {
    const categories = [...new Set(vendors.map((vendor) => vendor.category).filter(Boolean))];
    return categories
      .slice(0, 4)
      .map((category) => ({
        category,
        benchmark: categoryReputationBenchmarks[benchmarkKey(category)],
      }));
  }, [vendors, categoryReputationBenchmarks]);

  if (isPlanner && !selectedClient) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Vendors</h1>
          <p className="text-muted-foreground">{vendors.length} vendors tracked</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              setMode('directory');
              setDirSearch('');
              setDirResults([]);
              setForm({ name: '', category: 'Venue', phone: '', price: '' });
            }
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Add Vendor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="font-display">Add Vendor</DialogTitle></DialogHeader>
            <div className="flex gap-2 border-b border-border pb-3">
              <Button variant={mode === 'directory' ? 'default' : 'outline'} size="sm" onClick={() => setMode('directory')} className="gap-1">
                <Search className="h-3.5 w-3.5" /> From Directory
              </Button>
              <Button variant={mode === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setMode('custom')} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add Custom
              </Button>
            </div>
            {mode === 'directory' ? (
              <div className="space-y-3">
                <Input placeholder="Search verified vendors…" value={dirSearch} onChange={(e) => searchDirectory(e.target.value)} autoFocus />
                {dirLoading && <p className="text-sm text-muted-foreground">Searching…</p>}
                {dirResults.length > 0 ? (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {dirResults.map((dv) => {
                      const benchmark = categoryBenchmarks[benchmarkKey(dv.category)];
                      return (
                        <button key={dv.id} onClick={() => addFromDirectory(dv)} className="flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-accent/50 transition-colors">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground truncate">{dv.business_name}</span>
                              {dv.is_verified && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs">{dv.category}</Badge>
                              {dv.location && <span className="text-xs text-muted-foreground">{dv.location}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {benchmarkSummary(benchmark)}
                            </p>
                          </div>
                          <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                ) : dirSearch.trim().length >= 2 && !dirLoading ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm text-muted-foreground">No vendors found in directory.</p>
                    <Button variant="outline" size="sm" onClick={() => setMode('custom')}>Add Custom Vendor</Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Type at least 2 characters to search.</p>
                )}
              </div>
            ) : (
              <form onSubmit={addVendor} className="space-y-4">
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {modalBenchmarkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
                    Market signal for {form.category}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {modalBenchmarkLoading ? 'Loading price benchmark…' : benchmarkSummary(modalBenchmark)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Vendor Name</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Business name" required maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={value => setForm(f => ({ ...f, category: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {vendorCategories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Phone (optional)</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254..." />
                </div>
                <div className="space-y-2">
                  <Label>Quoted Price (KES, optional)</Label>
                  <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0" />
                  <p className="text-xs text-muted-foreground">
                    Saving a quote here automatically creates an anonymized price observation.
                  </p>
                </div>
                <Button type="submit" className="w-full">Add Vendor</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-card">
        <CardContent className="py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Pricing intelligence is active</p>
              <p className="text-sm text-muted-foreground">
                Vendor price changes here feed your private benchmark dataset.
                {selectedClient?.wedding_location ? ` Benchmarks are tuned to ${selectedClient.wedding_location}.` : ''}
              </p>
            </div>
            {benchmarksLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing benchmarks
              </div>
            )}
          </div>
          {trackedCategoryBenchmarks.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {trackedCategoryBenchmarks.map(({ category, benchmark }) => (
                <div key={category} className="rounded-lg border border-border/70 bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{category}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {benchmark?.sample_size ?? 0} obs
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{benchmarkSummary(benchmark)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Vendor reputation graph is active</p>
              <p className="text-sm text-muted-foreground">
                Scorecards stay private to planners and admins until enough trusted reviews exist.
              </p>
            </div>
            {reputationBenchmarksLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing trust benchmarks
              </div>
            )}
          </div>
          {trackedReputationBenchmarks.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {trackedReputationBenchmarks.map(({ category, benchmark }) => (
                <div key={category} className="rounded-lg border border-border/70 bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{category}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {benchmark?.sample_size ?? 0} reviews
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{reputationSummary(benchmark)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {vendors.map((vendor) => {
          const categoryBenchmark = categoryBenchmarks[benchmarkKey(vendor.category)];
          const listingBenchmark = vendor.vendor_listing_id ? listingBenchmarks[vendor.vendor_listing_id] : null;
          const activeBenchmark = listingBenchmark?.benchmark_visible ? listingBenchmark : categoryBenchmark;
          const benchmarkLabel = listingBenchmark?.benchmark_visible ? 'This vendor benchmark' : `${vendor.category} benchmark`;
          const hasMedian = activeBenchmark?.benchmark_visible && activeBenchmark.median_amount;
          const priceDelta = hasMedian && vendor.price
            ? Math.round(((vendor.price - (activeBenchmark?.median_amount ?? 0)) / (activeBenchmark?.median_amount ?? 1)) * 100)
            : null;
          const existingReview = reviewsBySourceVendorId[vendor.id];
          const categoryReputation = categoryReputationBenchmarks[benchmarkKey(vendor.category)];
          const listingReputation = vendor.vendor_listing_id ? listingReputationBenchmarks[vendor.vendor_listing_id] : null;
          const activeReputation = listingReputation?.benchmark_visible ? listingReputation : categoryReputation;
          const canReview = vendor.status === 'booked' || vendor.status === 'completed';

          return (
            <Card key={vendor.id} className="shadow-card">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-medium">{vendor.name}</CardTitle>
                  <Badge variant="outline" className="mt-1 text-xs">{vendor.category}</Badge>
                </div>
                <button onClick={() => deleteVendor(vendor.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardHeader>
              <CardContent className="space-y-4">
                {vendor.phone && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {vendor.phone}
                  </p>
                )}

                <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{benchmarkLabel}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {activeBenchmark?.sample_size ?? 0} obs
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {benchmarkSummary(activeBenchmark)}
                  </p>
                  {priceDelta != null && (
                    <p className="mt-2 text-xs font-medium text-foreground">
                      Current quote is {Math.abs(priceDelta)}% {priceDelta >= 0 ? 'above' : 'below'} the benchmark median.
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">Planner trust signal</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {activeReputation?.sample_size ?? 0} reviews
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reputationSummary(activeReputation)}
                  </p>
                  {existingReview ? (
                    <div className="mt-3 rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        Your scorecard: {existingReview.overall_rating}/5 overall
                      </p>
                      <p className="mt-1">
                        {existingReview.would_hire_again ? 'Would hire again' : 'Would not hire again'} · {existingReview.delivered_on_time === null ? 'Timing not rated' : existingReview.delivered_on_time ? 'Delivered on time' : 'Delivery timing issue'}
                      </p>
                      <p className="mt-1">{formatIssueFlags(existingReview.issue_flags ?? [])}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Add a scorecard after the vendor is booked or completed to grow your planner-only reputation graph.
                    </p>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`price-${vendor.id}`}>Quoted / booked price</Label>
                    <Input
                      id={`price-${vendor.id}`}
                      type="number"
                      value={priceDrafts[vendor.id] ?? ''}
                      onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [vendor.id]: e.target.value }))}
                      placeholder="0"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => updateVendorPrice(vendor)}
                    disabled={savingPriceId === vendor.id}
                  >
                    {savingPriceId === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Price
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="text-sm text-muted-foreground">
                      Mark booked vendors to strengthen paid-price benchmarks.
                    </p>
                  </div>
                  <Select value={vendor.status || 'contacted'} onValueChange={(status) => updateStatus(vendor.id, status)}>
                    <SelectTrigger className="h-9 w-36 text-xs" disabled={savingStatusId === vendor.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Post-event review</p>
                    <p className="text-sm text-muted-foreground">
                      {existingReview
                        ? 'Scorecard captured. This vendor is now contributing to planner trust data.'
                        : canReview
                          ? 'Capture a private scorecard now that this vendor is engaged.'
                          : 'Move this vendor to booked or completed before leaving a scorecard.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={!canReview || Boolean(existingReview)}
                    onClick={() => {
                      resetReviewForm();
                      setReviewDialogVendor(vendor);
                    }}
                  >
                    <Star className="h-4 w-4" />
                    {existingReview ? 'Reviewed' : 'Review Vendor'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {vendors.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-12">No vendors yet. Start by adding your venue!</p>
        )}
      </div>

      <Dialog
        open={Boolean(reviewDialogVendor)}
        onOpenChange={(openState) => {
          if (!openState) {
            setReviewDialogVendor(null);
            resetReviewForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              Review {reviewDialogVendor?.name}
            </DialogTitle>
          </DialogHeader>
          {reviewDialogVendor && (
            <div className="space-y-5">
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
                This scorecard is private to planners and admins. Aggregate trust scores only unlock after enough planner reviews exist.
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['Overall', 'overallRating'],
                  ['Reliability', 'reliabilityRating'],
                  ['Communication', 'communicationRating'],
                  ['Quality', 'qualityRating'],
                  ['Punctuality', 'punctualityRating'],
                  ['Value', 'valueRating'],
                ].map(([label, key]) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Select
                      value={reviewForm[key as keyof typeof reviewForm] as string}
                      onValueChange={(value) => setReviewForm((prev) => ({ ...prev, [key]: value }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[5, 4, 3, 2, 1].map((score) => (
                          <SelectItem key={score} value={String(score)}>
                            {score} / 5
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Delivered on time</Label>
                  <Select value={reviewForm.deliveredOnTime} onValueChange={(value) => setReviewForm((prev) => ({ ...prev, deliveredOnTime: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Would hire again</Label>
                  <Select value={reviewForm.wouldHireAgain} onValueChange={(value) => setReviewForm((prev) => ({ ...prev, wouldHireAgain: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Visibility</Label>
                <Select value={reviewForm.visibility} onValueChange={(value) => setReviewForm((prev) => ({ ...prev, visibility: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planner_network">Planner network benchmark</SelectItem>
                    <SelectItem value="private">Private to you</SelectItem>
                    <SelectItem value="admin_only">Admin only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Issue flags</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {issueFlagOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleIssueFlag(option.value)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        reviewForm.issueFlags.includes(option.value)
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-background text-muted-foreground hover:bg-accent/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-notes">Private notes</Label>
                <Input
                  id="review-notes"
                  value={reviewForm.privateNotes}
                  onChange={(e) => setReviewForm((prev) => ({ ...prev, privateNotes: e.target.value }))}
                  placeholder="What should another planner know about working with this vendor?"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReviewDialogVendor(null);
                    resetReviewForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={reviewSubmitting}
                  onClick={() => submitReview(reviewDialogVendor)}
                >
                  {reviewSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Save Scorecard
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
