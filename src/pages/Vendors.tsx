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
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Phone, Search, CheckCircle2, Loader2, Save, Sparkles, ShieldCheck, Star, Receipt, CalendarClock, ClipboardList, WandSparkles, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { getVendorPriceBenchmark, type VendorPriceBenchmark } from '@/lib/vendorPriceIntelligence';
import {
  setVendorSelectionStatus,
  vendorSelectionLabel,
  vendorSelectionTone,
  type VendorSelectionStatus,
} from '@/lib/vendorSelection';
import {
  updateVendorPaymentState,
  vendorPaymentStatusLabel,
  vendorPaymentStatusTone,
  vendorPaymentStatuses,
  type VendorPaymentStatus,
} from '@/lib/vendorPayments';
import {
  createVendorReputationReview,
  getVendorReputationBenchmark,
  listVendorReputationReviews,
  type VendorReputationBenchmark,
  type VendorReputationIssueFlag,
  type VendorReputationReview,
} from '@/lib/vendorReputation';
import { createVendorTask, createVendorTaskBundle } from '@/lib/vendorTasks';

interface Vendor {
  amount_paid: number;
  deposit_amount: number;
  id: string;
  last_payment_at: string | null;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  payment_due_date: string | null;
  payment_status: string;
  price: number | null;
  selection_status: string;
  selection_updated_at: string;
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

interface PaymentDraft {
  depositAmount: string;
  amountPaid: string;
  paymentStatus: VendorPaymentStatus;
  paymentDueDate: string;
}

interface VendorTaskItem {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  source_vendor_id: string | null;
}

const vendorCategories = ['Venue', 'Catering', 'Photography', 'Videography', 'Flowers', 'Music/DJ', 'Décor', 'Transport', 'MC', 'Cake', 'Other'];
const vendorStatuses = ['contacted', 'quoted', 'booked', 'completed', 'rejected'] as const;
const selectionStatuses: VendorSelectionStatus[] = ['shortlisted', 'final', 'backup', 'declined'];
const selectionSortOrder: Record<string, number> = {
  final: 0,
  shortlisted: 1,
  backup: 2,
  declined: 3,
};
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
    return `Planner / committee score ${benchmark.average_overall_rating.toFixed(1)}/5 · ${hireAgainRate}`;
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

function reviewSourceLabel(source?: string | null, role?: string | null) {
  if (source === 'committee') return role ? `Committee planned wedding · ${role}` : 'Committee planned wedding';
  if (source === 'admin') return 'Admin review';
  return 'Professional planner review';
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
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({});
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [savingSelectionId, setSavingSelectionId] = useState<string | null>(null);
  const [comparisonCategory, setComparisonCategory] = useState<string>('all');
  const [modalBenchmark, setModalBenchmark] = useState<VendorPriceBenchmark | null>(null);
  const [modalBenchmarkLoading, setModalBenchmarkLoading] = useState(false);
  const [reputationBenchmarksLoading, setReputationBenchmarksLoading] = useState(false);
  const [categoryReputationBenchmarks, setCategoryReputationBenchmarks] = useState<Record<string, VendorReputationBenchmark>>({});
  const [listingReputationBenchmarks, setListingReputationBenchmarks] = useState<Record<string, VendorReputationBenchmark>>({});
  const [reviewsBySourceVendorId, setReviewsBySourceVendorId] = useState<Record<string, VendorReputationReview>>({});
  const [reviewDialogVendor, setReviewDialogVendor] = useState<Vendor | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [vendorTasksByVendorId, setVendorTasksByVendorId] = useState<Record<string, VendorTaskItem[]>>({});
  const [vendorTaskDialogVendor, setVendorTaskDialogVendor] = useState<Vendor | null>(null);
  const [vendorTaskSubmitting, setVendorTaskSubmitting] = useState(false);
  const [creatingVendorTaskBundleId, setCreatingVendorTaskBundleId] = useState<string | null>(null);
  const [vendorTaskForm, setVendorTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    assignedTo: '',
  });
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

    const rows = (data ?? []).map((d) => ({
      ...d,
      amount_paid: Number(d.amount_paid ?? 0),
      deposit_amount: Number(d.deposit_amount ?? 0),
      price: d.price ? Number(d.price) : null,
    })) as Vendor[];
    setVendors(rows);
    setPriceDrafts(Object.fromEntries(rows.map((row) => [row.id, row.price != null ? String(row.price) : ''])));
    setPaymentDrafts(
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          {
            depositAmount: String(row.deposit_amount ?? 0),
            amountPaid: String(row.amount_paid ?? 0),
            paymentStatus: (row.payment_status || 'unpaid') as VendorPaymentStatus,
            paymentDueDate: row.payment_due_date ?? '',
          },
        ]),
      ),
    );
  };

  useEffect(() => {
    void load();
  }, [user, selectedClient, dataOrFilter]);

  const loadVendorTasks = async () => {
    if (!dataOrFilter) return;
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, due_date, completed, source_vendor_id')
      .or(dataOrFilter)
      .not('source_vendor_id', 'is', null)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) {
      toast({
        title: 'Failed to load vendor tasks',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    const grouped = (data as VendorTaskItem[] | null)?.reduce((summary, task) => {
      if (!task.source_vendor_id) return summary;
      summary[task.source_vendor_id] = [...(summary[task.source_vendor_id] ?? []), task];
      return summary;
    }, {} as Record<string, VendorTaskItem[]>) ?? {};

    setVendorTasksByVendorId(grouped);
  };

  useEffect(() => {
    void loadVendorTasks();
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

  const updateStatus = async (vendor: Vendor, status: string) => {
    setSavingStatusId(vendor.id);
    const updates: Record<string, unknown> = { status };
    if (status === 'rejected') updates.selection_status = 'declined';
    const { error } = await supabase.from('vendors').update(updates).eq('id', vendor.id);
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

  const updateVendorPayment = async (vendor: Vendor) => {
    const draft = paymentDrafts[vendor.id];
    if (!draft) return;

    const contractAmountDraft = priceDrafts[vendor.id]?.trim() ?? '';
    const contractAmount = contractAmountDraft === '' ? null : Number(contractAmountDraft);
    const depositAmount = draft.depositAmount.trim() === '' ? 0 : Number(draft.depositAmount);
    const amountPaid = draft.amountPaid.trim() === '' ? 0 : Number(draft.amountPaid);

    if (contractAmountDraft !== '' && (!Number.isFinite(contractAmount) || (contractAmount ?? 0) <= 0)) {
      toast({
        title: 'Invalid contract amount',
        description: 'Enter a valid KES amount greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(depositAmount) || !Number.isFinite(amountPaid) || depositAmount < 0 || amountPaid < 0) {
      toast({
        title: 'Invalid payment amounts',
        description: 'Deposit and paid amounts must be zero or higher.',
        variant: 'destructive',
      });
      return;
    }

    setSavingPaymentId(vendor.id);
    try {
      await updateVendorPaymentState({
        vendorId: vendor.id,
        contractAmount,
        depositAmount,
        amountPaid,
        paymentStatus: draft.paymentStatus,
        paymentDueDate: draft.paymentDueDate || null,
      });

      toast({
        title: 'Payment plan updated',
        description: `${vendor.name} now shows ${vendorPaymentStatusLabel(draft.paymentStatus).toLowerCase()}.`,
      });
      await load();
    } catch (error: any) {
      toast({
        title: 'Failed to save payment state',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingPaymentId(null);
    }
  };

  const deleteVendor = async (id: string) => {
    await supabase.from('vendors').delete().eq('id', id);
    await load();
  };

  const updateSelection = async (vendor: Vendor, selectionStatus: VendorSelectionStatus) => {
    setSavingSelectionId(vendor.id);
    try {
      await setVendorSelectionStatus(vendor.id, selectionStatus);
      toast({
        title: selectionStatus === 'final' ? 'Final vendor selected' : 'Vendor selection updated',
        description:
          selectionStatus === 'final'
            ? `${vendor.name} is now your final ${vendor.category.toLowerCase()} choice.`
            : `${vendor.name} is now marked as ${vendorSelectionLabel(selectionStatus).toLowerCase()}.`,
      });
      await load();
    } catch (error: any) {
      toast({
        title: 'Failed to update vendor decision',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSelectionId(null);
    }
  };

  const resetVendorTaskForm = () => {
    setVendorTaskForm({
      title: '',
      description: '',
      dueDate: '',
      assignedTo: '',
    });
  };

  const submitVendorTask = async (vendor: Vendor) => {
    if (!user) return;
    if (!vendorTaskForm.title.trim()) {
      toast({
        title: 'Task title required',
        description: 'Add a task title before saving.',
        variant: 'destructive',
      });
      return;
    }

    setVendorTaskSubmitting(true);
    try {
      await createVendorTask({
        userId: user.id,
        title: vendorTaskForm.title.trim(),
        description: vendorTaskForm.description.trim() || null,
        dueDate: vendorTaskForm.dueDate || null,
        assignedTo: vendorTaskForm.assignedTo.trim() || null,
        category: vendor.category,
        clientId: selectedClient?.id ?? null,
        sourceVendorId: vendor.id,
      });
      toast({
        title: 'Vendor task created',
        description: `${vendor.name} now has a linked planning task.`,
      });
      resetVendorTaskForm();
      setVendorTaskDialogVendor(null);
      await loadVendorTasks();
    } catch (error: any) {
      toast({
        title: 'Failed to create vendor task',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setVendorTaskSubmitting(false);
    }
  };

  const buildVendorTaskBundle = async (vendor: Vendor) => {
    if (!user) return;
    setCreatingVendorTaskBundleId(vendor.id);
    try {
      const created = await createVendorTaskBundle({
        userId: user.id,
        vendorId: vendor.id,
        vendorName: vendor.name,
        category: vendor.category,
        clientId: selectedClient?.id ?? null,
      });
      toast({
        title: created.length ? 'Vendor task bundle created' : 'Vendor task bundle already exists',
        description: created.length
          ? `${created.length} linked tasks were added for ${vendor.name}.`
          : `No new tasks were needed for ${vendor.name}.`,
      });
      await loadVendorTasks();
    } catch (error: any) {
      toast({
        title: 'Failed to create task bundle',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreatingVendorTaskBundleId(null);
    }
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

  const sortedVendors = useMemo(
    () =>
      [...vendors].sort((left, right) => {
        const categoryCompare = left.category.localeCompare(right.category);
        if (categoryCompare !== 0) return categoryCompare;

        const selectionCompare =
          (selectionSortOrder[left.selection_status ?? 'shortlisted'] ?? 99) -
          (selectionSortOrder[right.selection_status ?? 'shortlisted'] ?? 99);
        if (selectionCompare !== 0) return selectionCompare;

        return left.name.localeCompare(right.name);
      }),
    [vendors],
  );

  const selectionCounts = useMemo(() => {
    return vendors.reduce(
      (summary, vendor) => {
        const key = (vendor.selection_status || 'shortlisted') as VendorSelectionStatus;
        summary[key] += 1;
        return summary;
      },
      {
        shortlisted: 0,
        final: 0,
        backup: 0,
        declined: 0,
      } as Record<VendorSelectionStatus, number>,
    );
  }, [vendors]);

  const finalVendorEntries = useMemo(
    () => sortedVendors.filter((vendor) => vendor.selection_status === 'final'),
    [sortedVendors],
  );

  const finalVendorPaymentSummary = useMemo(() => {
    const totalContract = finalVendorEntries.reduce((sum, vendor) => sum + (vendor.price ?? 0), 0);
    const totalPaid = finalVendorEntries.reduce((sum, vendor) => sum + (vendor.amount_paid ?? 0), 0);
    const totalOutstanding = finalVendorEntries.reduce(
      (sum, vendor) => sum + Math.max((vendor.price ?? 0) - (vendor.amount_paid ?? 0), 0),
      0,
    );

    return { totalContract, totalPaid, totalOutstanding };
  }, [finalVendorEntries]);

  const vendorTaskSummary = useMemo(() => {
    const vendorTaskGroups = Object.values(vendorTasksByVendorId);
    const linkedTasks = vendorTaskGroups.flat();
    const openTasks = linkedTasks.filter((task) => !task.completed);
    const vendorsWithOpenTasks = vendorTaskGroups.filter((tasks) => tasks.some((task) => !task.completed)).length;

    return {
      linkedTasks: linkedTasks.length,
      openTasks: openTasks.length,
      vendorsWithOpenTasks,
    };
  }, [vendorTasksByVendorId]);

  const categoriesNeedingFinalChoice = useMemo(() => {
    const grouped = new Map<string, Vendor[]>();
    vendors.forEach((vendor) => {
      const current = grouped.get(vendor.category) ?? [];
      current.push(vendor);
      grouped.set(vendor.category, current);
    });

    return [...grouped.entries()]
      .filter(([, group]) => {
        const activeVendors = group.filter((vendor) => vendor.selection_status !== 'declined');
        return activeVendors.length > 0 && !activeVendors.some((vendor) => vendor.selection_status === 'final');
      })
      .map(([category, group]) => ({
        category,
        shortlistedCount: group.filter((vendor) => vendor.selection_status === 'shortlisted').length,
      }))
      .sort((left, right) => left.category.localeCompare(right.category));
  }, [vendors]);

  const comparisonCategories = useMemo(
    () =>
      [...new Set(vendors.map((vendor) => vendor.category))]
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [vendors],
  );

  const activeComparisonCategory = useMemo(() => {
    if (comparisonCategory !== 'all' && comparisonCategories.includes(comparisonCategory)) return comparisonCategory;
    return categoriesNeedingFinalChoice[0]?.category ?? comparisonCategories[0] ?? 'all';
  }, [comparisonCategory, categoriesNeedingFinalChoice, comparisonCategories]);

  const decisionWorkspaceVendors = useMemo(() => {
    if (activeComparisonCategory === 'all') return [];

    return sortedVendors.filter(
      (vendor) =>
        vendor.category === activeComparisonCategory &&
        vendor.selection_status !== 'declined' &&
        vendor.status !== 'rejected',
    );
  }, [activeComparisonCategory, sortedVendors]);

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

      <Card className="shadow-card">
        <CardContent className="py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Vendor decision board</p>
              <p className="text-sm text-muted-foreground">
                Keep multiple options shortlisted, then lock one final vendor per category when you are ready.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {selectionStatuses.map((status) => (
              <div key={status} className="rounded-lg border border-border/70 bg-background px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{vendorSelectionLabel(status)}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{selectionCounts[status]}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
              <p className="text-sm font-medium text-foreground">Final vendor lineup</p>
              {finalVendorEntries.length > 0 ? (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {finalVendorEntries.map((vendor) => (
                      <Badge key={vendor.id} className="rounded-full">
                        {vendor.category}: {vendor.name}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Final contracts</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(finalVendorPaymentSummary.totalContract)}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid so far</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(finalVendorPaymentSummary.totalPaid)}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(finalVendorPaymentSummary.totalOutstanding)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No final vendors selected yet. Shortlist options first, then mark one final choice per category.
                </p>
              )}
            </div>
            <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
              <p className="text-sm font-medium text-foreground">Categories awaiting a final choice</p>
              {categoriesNeedingFinalChoice.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {categoriesNeedingFinalChoice.map((item) => (
                    <Badge key={item.category} variant="outline" className="rounded-full">
                      {item.category} · {item.shortlistedCount} shortlisted
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Every active category already has a final vendor decision recorded.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Decision workspace</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Compare shortlisted vendors in one category at a time using price, trust, payment, and task context.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="comparison-category" className="text-xs uppercase tracking-wide text-muted-foreground">
                Compare category
              </Label>
              <Select value={activeComparisonCategory} onValueChange={setComparisonCategory}>
                <SelectTrigger id="comparison-category" className="w-52">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {comparisonCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {decisionWorkspaceVendors.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[860px] rounded-xl border border-border/70 bg-background">
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `180px repeat(${decisionWorkspaceVendors.length}, minmax(200px, 1fr))` }}
                >
                  <div className="border-b border-r border-border/70 bg-muted/40 px-4 py-3 text-sm font-medium text-foreground">
                    Compare
                  </div>
                  {decisionWorkspaceVendors.map((vendor) => {
                    const linkedTasks = vendorTasksByVendorId[vendor.id] ?? [];
                    const openLinkedTasks = linkedTasks.filter((task) => !task.completed);
                    const categoryBenchmark = categoryBenchmarks[benchmarkKey(vendor.category)];
                    const listingBenchmark = vendor.vendor_listing_id ? listingBenchmarks[vendor.vendor_listing_id] : null;
                    const activeBenchmark = listingBenchmark?.benchmark_visible ? listingBenchmark : categoryBenchmark;
                    const activeReputation = vendor.vendor_listing_id && listingReputationBenchmarks[vendor.vendor_listing_id]?.benchmark_visible
                      ? listingReputationBenchmarks[vendor.vendor_listing_id]
                      : categoryReputationBenchmarks[benchmarkKey(vendor.category)];
                    const priceDelta =
                      activeBenchmark?.benchmark_visible && activeBenchmark.median_amount && vendor.price
                        ? Math.round(((vendor.price - activeBenchmark.median_amount) / activeBenchmark.median_amount) * 100)
                        : null;

                    return (
                      <div key={vendor.id} className="border-b border-border/70 px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">{vendor.name}</p>
                            <p className="text-xs text-muted-foreground">{vendor.category}</p>
                          </div>
                          <Badge variant={vendorSelectionTone(vendor.selection_status)} className="text-[10px]">
                            {vendorSelectionLabel(vendor.selection_status)}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={vendor.selection_status === 'final' ? 'secondary' : 'default'}
                            onClick={() => updateSelection(vendor, 'final')}
                            disabled={savingSelectionId === vendor.id || vendor.selection_status === 'final'}
                          >
                            {vendor.selection_status === 'final' ? 'Final choice' : 'Make final'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              resetVendorTaskForm();
                              setVendorTaskDialogVendor(vendor);
                            }}
                          >
                            Add task
                          </Button>
                        </div>
                        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                          <p>Quote: {formatCurrency(vendor.price)}</p>
                          <p>
                            Benchmark:{' '}
                            {activeBenchmark?.benchmark_visible
                              ? formatCurrency(activeBenchmark.median_amount)
                              : 'Waiting for more data'}
                          </p>
                          <p>
                            Trust:{' '}
                            {activeReputation?.benchmark_visible && activeReputation.average_overall_rating != null
                              ? `${activeReputation.average_overall_rating.toFixed(1)}/5`
                              : 'Insufficient reviews'}
                          </p>
                          <p>Paid: {formatCurrency(vendor.amount_paid)}</p>
                          <p>Outstanding: {formatCurrency(Math.max((vendor.price ?? 0) - (vendor.amount_paid ?? 0), 0))}</p>
                          <p>Open tasks: {openLinkedTasks.length}</p>
                          {priceDelta != null && (
                            <p>{Math.abs(priceDelta)}% {priceDelta >= 0 ? 'above' : 'below'} benchmark median</p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Quote</div>
                  {decisionWorkspaceVendors.map((vendor) => (
                    <div key={`${vendor.id}-quote`} className="px-4 py-3 text-sm text-foreground">
                      {formatCurrency(vendor.price)}
                    </div>
                  ))}

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Payment status</div>
                  {decisionWorkspaceVendors.map((vendor) => (
                    <div key={`${vendor.id}-payment`} className="px-4 py-3">
                      <Badge variant={vendorPaymentStatusTone(vendor.payment_status)} className="text-[10px]">
                        {vendorPaymentStatusLabel(vendor.payment_status)}
                      </Badge>
                    </div>
                  ))}

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Amount paid</div>
                  {decisionWorkspaceVendors.map((vendor) => (
                    <div key={`${vendor.id}-paid`} className="px-4 py-3 text-sm text-foreground">
                      {formatCurrency(vendor.amount_paid)}
                    </div>
                  ))}

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Open tasks</div>
                  {decisionWorkspaceVendors.map((vendor) => {
                    const linkedTasks = vendorTasksByVendorId[vendor.id] ?? [];
                    const openLinkedTasks = linkedTasks.filter((task) => !task.completed);
                    return (
                      <div key={`${vendor.id}-tasks`} className="px-4 py-3 text-sm text-foreground">
                        {openLinkedTasks.length}
                      </div>
                    );
                  })}

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Latest due</div>
                  {decisionWorkspaceVendors.map((vendor) => {
                    const linkedTasks = vendorTasksByVendorId[vendor.id] ?? [];
                    const openLinkedTasks = linkedTasks
                      .filter((task) => !task.completed && task.due_date)
                      .sort((left, right) => (left.due_date ?? '').localeCompare(right.due_date ?? ''));
                    return (
                      <div key={`${vendor.id}-due`} className="px-4 py-3 text-sm text-foreground">
                        {openLinkedTasks[0]?.due_date ? new Date(openLinkedTasks[0].due_date as string).toLocaleDateString() : 'No due date'}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Add or shortlist at least one active vendor in a category to open the comparison workspace.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardContent className="py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Vendor-linked task flow</p>
              <p className="text-sm text-muted-foreground">
                Tie follow-ups, payments, and confirmations to the exact vendor you are evaluating or booking.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked tasks</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{vendorTaskSummary.linkedTasks}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Open vendor tasks</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{vendorTaskSummary.openTasks}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Vendors with active actions</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{vendorTaskSummary.vendorsWithOpenTasks}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {sortedVendors.map((vendor) => {
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
          const linkedTasks = vendorTasksByVendorId[vendor.id] ?? [];
          const openLinkedTasks = linkedTasks.filter((task) => !task.completed);

          return (
            <Card key={vendor.id} className="shadow-card">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base font-medium">{vendor.name}</CardTitle>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">{vendor.category}</Badge>
                    <Badge variant={vendorSelectionTone(vendor.selection_status)} className="text-xs">
                      {vendorSelectionLabel(vendor.selection_status)}
                    </Badge>
                  </div>
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
                      <p className="text-sm font-medium text-foreground">Planner & committee trust signal</p>
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
                      <p className="mt-1">{reviewSourceLabel(existingReview.review_source, existingReview.review_source_role)}</p>
                      <p className="mt-1">
                        {existingReview.would_hire_again ? 'Would hire again' : 'Would not hire again'} · {existingReview.delivered_on_time === null ? 'Timing not rated' : existingReview.delivered_on_time ? 'Delivered on time' : 'Delivery timing issue'}
                      </p>
                      <p className="mt-1">{formatIssueFlags(existingReview.issue_flags ?? [])}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Add a scorecard after the vendor is booked or completed to grow the professional and committee reputation graph.
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

                <div className="rounded-lg border border-border/70 bg-background px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment tracking</p>
                      <p className="text-sm text-muted-foreground">
                        Track deposit, amount paid, and the next due date for this vendor.
                      </p>
                    </div>
                    <Badge variant={vendorPaymentStatusTone(vendor.payment_status)} className="text-xs">
                      {vendorPaymentStatusLabel(vendor.payment_status)}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contract</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{formatCurrency(vendor.price)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Paid</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{formatCurrency(vendor.amount_paid)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {formatCurrency(Math.max((vendor.price ?? 0) - (vendor.amount_paid ?? 0), 0))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`deposit-${vendor.id}`}>Deposit amount</Label>
                      <Input
                        id={`deposit-${vendor.id}`}
                        type="number"
                        value={paymentDrafts[vendor.id]?.depositAmount ?? '0'}
                        onChange={(e) =>
                          setPaymentDrafts((prev) => ({
                            ...prev,
                            [vendor.id]: {
                              ...(prev[vendor.id] ?? { depositAmount: '0', amountPaid: '0', paymentStatus: 'unpaid', paymentDueDate: '' }),
                              depositAmount: e.target.value,
                            },
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`paid-${vendor.id}`}>Amount paid</Label>
                      <Input
                        id={`paid-${vendor.id}`}
                        type="number"
                        value={paymentDrafts[vendor.id]?.amountPaid ?? '0'}
                        onChange={(e) =>
                          setPaymentDrafts((prev) => ({
                            ...prev,
                            [vendor.id]: {
                              ...(prev[vendor.id] ?? { depositAmount: '0', amountPaid: '0', paymentStatus: 'unpaid', paymentDueDate: '' }),
                              amountPaid: e.target.value,
                            },
                          }))
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment status</Label>
                      <Select
                        value={paymentDrafts[vendor.id]?.paymentStatus ?? 'unpaid'}
                        onValueChange={(value) =>
                          setPaymentDrafts((prev) => ({
                            ...prev,
                            [vendor.id]: {
                              ...(prev[vendor.id] ?? { depositAmount: '0', amountPaid: '0', paymentStatus: 'unpaid', paymentDueDate: '' }),
                              paymentStatus: value as VendorPaymentStatus,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="h-10 text-xs">
                          <SelectValue />
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
                      <Label htmlFor={`due-${vendor.id}`}>Next payment due date</Label>
                      <div className="relative">
                        <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id={`due-${vendor.id}`}
                          type="date"
                          className="pl-9"
                          value={paymentDrafts[vendor.id]?.paymentDueDate ?? ''}
                          onChange={(e) =>
                            setPaymentDrafts((prev) => ({
                              ...prev,
                              [vendor.id]: {
                                ...(prev[vendor.id] ?? { depositAmount: '0', amountPaid: '0', paymentStatus: 'unpaid', paymentDueDate: '' }),
                                paymentDueDate: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {vendor.last_payment_at
                        ? `Last payment update ${new Date(vendor.last_payment_at).toLocaleDateString()}.`
                        : 'No payment updates recorded yet.'}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => updateVendorPayment(vendor)}
                      disabled={savingPaymentId === vendor.id}
                    >
                      {savingPaymentId === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                      Save Payment Plan
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border/70 bg-background px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Vendor-linked tasks</p>
                      <p className="text-sm text-muted-foreground">
                        Keep quote, contract, and logistics work attached to this vendor.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {openLinkedTasks.length} open
                    </Badge>
                  </div>
                  {linkedTasks.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {linkedTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{task.title}</p>
                            <Badge variant={task.completed ? 'secondary' : 'outline'} className="text-[10px]">
                              {task.completed ? 'Done' : 'Open'}
                            </Badge>
                          </div>
                          {task.due_date && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Due {new Date(task.due_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      ))}
                      {linkedTasks.length > 3 && (
                        <p className="text-xs text-muted-foreground">
                          +{linkedTasks.length - 3} more linked tasks in the task board.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      No tasks linked yet. Create a quick bundle to seed vendor follow-ups.
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        resetVendorTaskForm();
                        setVendorTaskDialogVendor(vendor);
                      }}
                    >
                      <ClipboardList className="h-4 w-4" />
                      Add vendor task
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => buildVendorTaskBundle(vendor)}
                      disabled={creatingVendorTaskBundleId === vendor.id}
                    >
                      {creatingVendorTaskBundleId === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                      Create task bundle
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="text-sm text-muted-foreground">
                      Mark booked vendors to strengthen paid-price benchmarks.
                    </p>
                  </div>
                  <Select value={vendor.status || 'contacted'} onValueChange={(status) => updateStatus(vendor, status)}>
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

                <div className="rounded-lg border border-border/70 bg-background px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Selection workflow</p>
                      <p className="text-sm text-muted-foreground">
                        Keep options shortlisted, mark backups, and choose one final vendor for {vendor.category.toLowerCase()}.
                      </p>
                    </div>
                    <Select
                      value={(vendor.selection_status || 'shortlisted') as VendorSelectionStatus}
                      onValueChange={(value) => updateSelection(vendor, value as VendorSelectionStatus)}
                    >
                      <SelectTrigger className="h-9 w-40 text-xs" disabled={savingSelectionId === vendor.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectionStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {vendorSelectionLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={vendor.selection_status === 'final' ? 'secondary' : 'default'}
                      className="gap-2"
                      onClick={() => updateSelection(vendor, 'final')}
                      disabled={savingSelectionId === vendor.id || vendor.selection_status === 'final'}
                    >
                      {savingSelectionId === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {vendor.selection_status === 'final' ? 'Final choice locked' : 'Make final choice'}
                    </Button>
                    {vendor.selection_status === 'final' && (
                      <p className="self-center text-xs text-muted-foreground">
                        Other final vendors in this category are automatically moved to backup.
                      </p>
                    )}
                  </div>
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
        open={Boolean(vendorTaskDialogVendor)}
        onOpenChange={(openState) => {
          if (!openState) {
            setVendorTaskDialogVendor(null);
            resetVendorTaskForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              Add task for {vendorTaskDialogVendor?.name}
            </DialogTitle>
          </DialogHeader>
          {vendorTaskDialogVendor && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitVendorTask(vendorTaskDialogVendor);
              }}
            >
              <div className="space-y-2">
                <Label>Task title</Label>
                <Input
                  value={vendorTaskForm.title}
                  onChange={(event) => setVendorTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={`Confirm contract with ${vendorTaskDialogVendor.name}`}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Assign to (optional)</Label>
                <Input
                  value={vendorTaskForm.assignedTo}
                  onChange={(event) => setVendorTaskForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
                  placeholder="Couple, committee lead, planner, MC..."
                />
              </div>
              <div className="space-y-2">
                <Label>Due date (optional)</Label>
                <Input
                  type="date"
                  value={vendorTaskForm.dueDate}
                  onChange={(event) => setVendorTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  rows={3}
                  value={vendorTaskForm.description}
                  onChange={(event) => setVendorTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Add quote follow-up, payment notes, arrival details, or files to send..."
                />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={vendorTaskSubmitting}>
                {vendorTaskSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                Save vendor task
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
