import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Phone, Search, CheckCircle2, Loader2, Save, ShieldCheck, Star, Receipt, ClipboardList, ArrowRightLeft, ArrowLeft, Download, MessageSquareText, ChevronDown, ExternalLink, FileSignature } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { committeeResponsibilityOptions, contractStatusLabel } from '@/lib/committeeRoles';
import {
  createWorkspaceVendorInviteDraft,
  listWorkspaceVendorInvitesForVendor,
  updateWorkspaceVendorInvite,
  type WorkspaceVendorInvite,
} from '@/lib/workspaceVendorInvites';
import {
  getVendorLearningProfile,
  getVendorPriceBenchmark,
  type VendorLearningProfile,
  type VendorPriceBenchmark,
} from '@/lib/vendorPriceIntelligence';
import type { WeddingTaskPhase } from '@/lib/weddingTaskTemplates';
import {
  hasRecordedVendor,
  isChosenVendor,
  setVendorSelectionStatus,
  vendorSelectionLabel,
  vendorSelectionTone,
  type VendorSelectionStatus,
} from '@/lib/vendorSelection';
import {
  deriveVendorPaymentStatus,
  totalRecordedVendorPayments,
  updateVendorPaymentState,
  vendorPaymentStatusLabel,
  vendorPaymentStatusTone,
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
import { getSuggestedTaskTemplates, getTaskCategoryDefaults } from '@/lib/weddingTaskTemplates';
import { getEntitlementDecision, type EntitlementFeature } from '@/lib/entitlements';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { useMilestoneCelebration } from '@/hooks/useMilestoneCelebration';
import { useDeferredDelete } from '@/hooks/useDeferredDelete';
import { UpgradePromptDialog } from '@/components/UpgradePrompt';
import { downloadCsv, safeDateLabel } from '@/lib/exportHelpers';
import InlineAssistantCard from '@/components/InlineAssistantCard';
import InfoTip from '@/components/InfoTip';
import { useInlineAssistant } from '@/hooks/useInlineAssistant';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';
import { submitPlannerChangeRequest } from '@/lib/plannerChangeRequests';
import { WorkspacePageSkeleton } from '@/components/AppLoadingSkeletons';
import { FormFieldError, FormSubmitError } from '@/components/FormFeedback';
import { buildConciergeContext } from '@/lib/conciergeContext';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedCardDetails } from '@/components/AnimatedCardDetails';
import { PaymentReminderStatus } from '@/components/PaymentReminderStatus';
import {
  archiveVendorWorkspaceUpdate,
  listVendorWorkspaceUpdates,
  vendorWorkspaceUpdateLabel,
  type VendorWorkspaceUpdate,
} from '@/lib/vendorWorkspaceUpdates';
import {
  acceptVendorTaskSuggestion,
  dismissVendorTaskSuggestion,
  listVendorTaskSuggestions,
  type VendorTaskSuggestion,
} from '@/lib/vendorTaskSuggestions';
import { SlidingSegmentedControl } from '@/components/SlidingSegmentedControl';
import { getRelatedTasksForVendor } from '@/lib/budgetRelations';
import {
  canonicalizeVendorCategory,
  getVendorCategoryOptions,
  getVendorCategoryScope,
  vendorCategoriesMatch,
  vendorCategoryCatalog,
} from '@/lib/vendorCategories';
import {
  coupleVendorContractMessage,
  coupleVendorContractShareUrl,
  coupleVendorContractStatusLabel,
  getCoupleVendorContract,
} from '@/lib/coupleVendorContracts';
import { requestVendorQuote } from '@/lib/documentRequests';
import { recalculatePlanningExperiment } from '@/lib/planningExperimentService';
import CoupleLeadMarketplace from '@/components/leads/CoupleLeadMarketplace';

interface Vendor {
  amount_paid: number;
  committee_role_in_charge: string | null;
  contract_status: string;
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
  wedding_id: string | null;
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
  paymentStatus: VendorPaymentStatus;
  paymentDueDate: string;
}

interface WorkflowDraft {
  committeeRoleInCharge: string;
  contractStatus: string;
}

interface VendorDetailsDraft {
  name: string;
  category: string;
  email: string;
  phone: string;
}

interface VendorTaskItem {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  source_vendor_id: string | null;
  category: string | null;
  description: string | null;
  phase: WeddingTaskPhase | null;
  visibility: string;
  recommended_role: string | null;
}

interface VendorPaymentRecord {
  id: string;
  amount: number;
  category_name: string;
  payee_name: string;
  payment_date: string;
  reference: string | null;
  notes: string | null;
  vendor_id: string | null;
  budget_scope: 'wedding' | 'personal';
}

interface VendorPaymentForm {
  payeeName: string;
  amount: string;
  paymentDate: string;
  reference: string;
  notes: string;
}

interface VendorsWorkspaceData {
  categories: string[];
  vendors: Vendor[];
  vendorTasks: VendorTaskItem[];
  vendorPayments: VendorPaymentRecord[];
}

const emptyVendors: Vendor[] = [];

type VendorMilestoneStatus = 'not_started' | 'in_progress' | 'complete';

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

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase();
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

function learningConfidenceLabel(score: number) {
  if (score >= 80) return 'High confidence';
  if (score >= 50) return 'Building confidence';
  return 'Early signal';
}

function learningConfidenceTone(score: number) {
  if (score >= 80) return 'default' as const;
  if (score >= 50) return 'secondary' as const;
  return 'outline' as const;
}

function learningMarketPosition(
  predictedPrice: number | null | undefined,
  benchmark?: VendorPriceBenchmark | null,
) {
  if (!predictedPrice || !benchmark?.benchmark_visible || !benchmark.median_amount) return null;

  const ratio = predictedPrice / benchmark.median_amount;
  if (ratio <= 0.85) return 'Below market';
  if (ratio >= 1.15) return 'Premium';
  return 'Near market';
}

function reputationSummary(benchmark?: VendorReputationBenchmark | null) {
  if (!benchmark) return 'Loading planner trust data...';
  if (benchmark.benchmark_visible && benchmark.average_overall_rating != null) {
    const hireAgainRate = benchmark.hire_again_rate != null ? `${Math.round(benchmark.hire_again_rate * 100)}% would hire again` : 'Hire-again rate not available yet';
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

const vendorMilestonePhases: WeddingTaskPhase[] = [
  'research',
  'selection_booking',
  'second_payment',
  'closure_final_payment',
];

function vendorMilestoneLabel(phase: WeddingTaskPhase) {
  switch (phase) {
    case 'research':
      return 'Research';
    case 'selection_booking':
      return 'Booking';
    case 'second_payment':
      return 'Second payment';
    case 'closure_final_payment':
      return 'Closure';
    default:
      return phase;
  }
}

function vendorMilestoneTone(status: VendorMilestoneStatus) {
  switch (status) {
    case 'complete':
      return 'default' as const;
    case 'in_progress':
      return 'secondary' as const;
    case 'not_started':
    default:
      return 'outline' as const;
  }
}

function getVendorMilestoneState(vendor: Vendor, tasks: VendorTaskItem[], phase: WeddingTaskPhase): VendorMilestoneStatus {
  const phaseTasks = tasks.filter((task) => task.phase === phase);
  const hasCompletedTask = phaseTasks.some((task) => task.completed);
  const hasOpenTask = phaseTasks.some((task) => !task.completed);

  switch (phase) {
    case 'research':
      if (hasCompletedTask || vendor.status === 'quoted' || vendor.status === 'booked' || vendor.status === 'completed') return 'complete';
      if (hasOpenTask || ['shortlisted', 'backup', 'final', 'declined'].includes(vendor.selection_status || '')) return 'in_progress';
      return 'not_started';
    case 'selection_booking':
      if (hasCompletedTask || vendor.contract_status === 'signed' || vendor.status === 'booked' || vendor.status === 'completed' || vendor.selection_status === 'final') {
        return 'complete';
      }
      if (hasOpenTask || vendor.contract_status === 'drafting' || vendor.contract_status === 'sent' || vendor.selection_status === 'shortlisted' || vendor.selection_status === 'backup') {
        return 'in_progress';
      }
      return 'not_started';
    case 'second_payment':
      if (hasCompletedTask || vendor.payment_status === 'part_paid' || vendor.payment_status === 'paid_full') return 'complete';
      if (hasOpenTask || vendor.payment_status === 'deposit_due' || vendor.payment_status === 'deposit_paid') return 'in_progress';
      return 'not_started';
    case 'closure_final_payment':
      if (hasCompletedTask || (vendor.payment_status === 'paid_full' && (vendor.status === 'completed' || vendor.selection_status === 'final'))) {
        return 'complete';
      }
      if (
        hasOpenTask ||
        vendor.selection_status === 'final' ||
        vendor.status === 'booked' ||
        vendor.status === 'completed' ||
        vendor.payment_status === 'deposit_paid' ||
        vendor.payment_status === 'part_paid' ||
        vendor.contract_status === 'signed'
      ) {
        return 'in_progress';
      }
      return 'not_started';
    default:
      return 'not_started';
  }
}

function buildVendorMilestones(vendor: Vendor, tasks: VendorTaskItem[]) {
  return vendorMilestonePhases.map((phase) => {
    const phaseTasks = tasks.filter((task) => task.phase === phase);
    const nextOpenTask = phaseTasks
      .filter((task) => !task.completed)
      .sort((left, right) => (left.due_date ?? '').localeCompare(right.due_date ?? ''))[0] ?? null;

    return {
      phase,
      label: vendorMilestoneLabel(phase),
      status: getVendorMilestoneState(vendor, tasks, phase),
      openTaskCount: phaseTasks.filter((task) => !task.completed).length,
      completedTaskCount: phaseTasks.filter((task) => task.completed).length,
      nextOpenTask,
    };
  });
}

function getVendorsAssistantFeature(role?: string | null, plannerType?: string | null): EntitlementFeature {
  if (role === 'planner' && plannerType === 'committee') return 'committee.ai_assistant';
  if (role === 'planner') return 'planner.ai_assistant';
  return 'couple.ai_assistant';
}

async function loadVendorsWorkspace(dataOrFilter: string): Promise<VendorsWorkspaceData> {
  const [vendorsResult, tasksResult, paymentsResult] = await Promise.all([
    supabase.from('vendors').select('*').or(dataOrFilter).order('created_at'),
    supabase
      .from('tasks')
      .select('id, title, description, category, due_date, completed, source_vendor_id, phase, visibility, recommended_role')
      .or(dataOrFilter)
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('budget_payments')
      .select('id, amount, category_name, payee_name, payment_date, reference, notes, vendor_id, budget_scope')
      .or(dataOrFilter)
      .not('vendor_id', 'is', null)
      .order('payment_date', { ascending: false }),
  ]);

  if (vendorsResult.error) throw vendorsResult.error;
  if (tasksResult.error) throw tasksResult.error;
  if (paymentsResult.error) throw paymentsResult.error;

  const allVendors = ((vendorsResult.data ?? []).map((d) => ({
    ...d,
    category: canonicalizeVendorCategory(d.category),
    amount_paid: Number(d.amount_paid ?? 0),
    committee_role_in_charge: d.committee_role_in_charge ?? null,
    contract_status: d.contract_status ?? 'not_started',
    deposit_amount: Number(d.deposit_amount ?? 0),
    price: d.price ? Number(d.price) : null,
  })) as Vendor[]);
  const vendors = allVendors.filter(hasRecordedVendor);
  const recordedVendorIds = new Set(vendors.map((vendor) => vendor.id));

  return {
    categories: [
      ...new Set([
        ...vendorCategoryCatalog.map((category) => category.name),
        ...allVendors.map((vendor) => vendor.category).filter(Boolean),
      ]),
    ],
    vendors,
    vendorTasks: ((tasksResult.data as VendorTaskItem[] | null) ?? []).filter(
      (task) => !task.source_vendor_id || recordedVendorIds.has(task.source_vendor_id),
    ),
    vendorPayments: ((paymentsResult.data as VendorPaymentRecord[] | null) ?? []).filter(
      (payment) => !payment.vendor_id || recordedVendorIds.has(payment.vendor_id),
    ),
  };
}

export default function Vendors() {
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter, plannerClientHydrating } = usePlanner();
  const {
    weddingId: entitlementWeddingId,
    entitlements: weddingEntitlements,
    couplePlanTier,
  } = useWeddingEntitlements();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { pendingIds: pendingDeleteIds, scheduleDelete } = useDeferredDelete();
  const queryClient = useQueryClient();
  const assistantPanel = useAssistantPanel();
  const prefersReducedMotion = useReducedMotion();
  const plannerNeedsApproval = isPlanner && Boolean(selectedClient?.linked_user_id);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'directory' | 'custom'>('custom');
  const [form, setForm] = useState({ name: '', category: 'Wedding Venue', email: '', phone: '', price: '' });
  const [addingVendor, setAddingVendor] = useState(false);
  const [vendorFormErrors, setVendorFormErrors] = useState<{ name?: string; email?: string; phone?: string; price?: string }>({});
  const [vendorSubmitError, setVendorSubmitError] = useState<string | null>(null);
  const [dirSearch, setDirSearch] = useState('');
  const [dirResults, setDirResults] = useState<DirectoryVendor[]>([]);
  const [directoryPool, setDirectoryPool] = useState<DirectoryVendor[]>([]);
  const [dirLoading, setDirLoading] = useState(false);
  const [benchmarksLoading, setBenchmarksLoading] = useState(false);
  const [categoryBenchmarks, setCategoryBenchmarks] = useState<Record<string, VendorPriceBenchmark>>({});
  const [listingBenchmarks, setListingBenchmarks] = useState<Record<string, VendorPriceBenchmark>>({});
  const [vendorLearningProfiles, setVendorLearningProfiles] = useState<Record<string, VendorLearningProfile | null>>({});
  const [vendorLearningLoadingListingId, setVendorLearningLoadingListingId] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({});
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null);
  const [savingPaymentId, setSavingPaymentId] = useState<string | null>(null);
  const [savingWorkflowId, setSavingWorkflowId] = useState<string | null>(null);
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [savingSelectionId, setSavingSelectionId] = useState<string | null>(null);
  const [selectionSucceededId, setSelectionSucceededId] = useState<string | null>(null);
  const [workflowDrafts, setWorkflowDrafts] = useState<Record<string, WorkflowDraft>>({});
  const [notesDrafts, setNotesDrafts] = useState<Record<string, string>>({});
  const [vendorDetailsDrafts, setVendorDetailsDrafts] = useState<Record<string, VendorDetailsDraft>>({});
  const [savingVendorDetailsId, setSavingVendorDetailsId] = useState<string | null>(null);
  const [requestingQuoteVendorId, setRequestingQuoteVendorId] = useState<string | null>(null);
  const [comparisonCategory, setComparisonCategory] = useState<string>('all');
  const [modalBenchmark, setModalBenchmark] = useState<VendorPriceBenchmark | null>(null);
  const [modalBenchmarkLoading, setModalBenchmarkLoading] = useState(false);
  const [reputationBenchmarksLoading, setReputationBenchmarksLoading] = useState(false);
  const [categoryReputationBenchmarks, setCategoryReputationBenchmarks] = useState<Record<string, VendorReputationBenchmark>>({});
  const [listingReputationBenchmarks, setListingReputationBenchmarks] = useState<Record<string, VendorReputationBenchmark>>({});
  const [reviewsBySourceVendorId, setReviewsBySourceVendorId] = useState<Record<string, VendorReputationReview>>({});
  const [reviewDialogVendor, setReviewDialogVendor] = useState<Vendor | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [vendorTaskDialogVendor, setVendorTaskDialogVendor] = useState<Vendor | null>(null);
  const [vendorTaskSubmitting, setVendorTaskSubmitting] = useState(false);
  const [vendorTaskFormErrors, setVendorTaskFormErrors] = useState<{ title?: string }>({});
  const [vendorTaskSubmitError, setVendorTaskSubmitError] = useState<string | null>(null);
  const [creatingVendorTaskBundleId, setCreatingVendorTaskBundleId] = useState<string | null>(null);
  const [vendorListView, setVendorListView] = useState<'by_category' | 'by_name'>('by_category');
  const [vendorWorkspaceQuery, setVendorWorkspaceQuery] = useState('');
  const [showEmptyVendorCategories, setShowEmptyVendorCategories] = useState(false);
  const [expandedVendorCategories, setExpandedVendorCategories] = useState<Record<string, boolean>>({});
  const [exportUpgradeOpen, setExportUpgradeOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [selectedVendorTab, setSelectedVendorTab] = useState<'details' | 'tasks' | 'payments'>('details');
  const [highlightedVendorSection, setHighlightedVendorSection] = useState<string | null>(null);
  const [recordVendorPaymentOpen, setRecordVendorPaymentOpen] = useState(false);
  const [recordingVendorPayment, setRecordingVendorPayment] = useState(false);
  const [vendorPaymentFormErrors, setVendorPaymentFormErrors] = useState<{ payeeName?: string; amount?: string }>({});
  const [vendorPaymentSubmitError, setVendorPaymentSubmitError] = useState<string | null>(null);
  const [vendorPaymentForm, setVendorPaymentForm] = useState<VendorPaymentForm>({
    payeeName: '',
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
  });
  const [vendorTaskForm, setVendorTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    assignedTo: '',
  });
  const [vendorTaskTemplateKey, setVendorTaskTemplateKey] = useState('none');
  const [workspaceVendorInvites, setWorkspaceVendorInvites] = useState<Record<string, WorkspaceVendorInvite[]>>({});
  const [workspaceInviteLoadingVendorId, setWorkspaceInviteLoadingVendorId] = useState<string | null>(null);
  const [workspaceInviteSubmittingVendorId, setWorkspaceInviteSubmittingVendorId] = useState<string | null>(null);
  const [workspaceInviteError, setWorkspaceInviteError] = useState<string | null>(null);
  const [workspaceInviteForm, setWorkspaceInviteForm] = useState({
    email: '',
    phone: '',
    message: '',
    expiresAt: '',
  });
  const [contactEditorVendor, setContactEditorVendor] = useState<Vendor | null>(null);
  const [contactEditorForm, setContactEditorForm] = useState({ email: '', phone: '' });
  const [contactEditorErrors, setContactEditorErrors] = useState<{ email?: string; phone?: string }>({});
  const [contactEditorSubmitError, setContactEditorSubmitError] = useState<string | null>(null);
  const [savingVendorContact, setSavingVendorContact] = useState(false);
  const [createClaimAfterContactSave, setCreateClaimAfterContactSave] = useState(false);
  const [vendorWorkspaceUpdates, setVendorWorkspaceUpdates] = useState<Record<string, VendorWorkspaceUpdate[]>>({});
  const [vendorWorkspaceUpdatesLoadingId, setVendorWorkspaceUpdatesLoadingId] = useState<string | null>(null);
  const [archivingVendorWorkspaceUpdateId, setArchivingVendorWorkspaceUpdateId] = useState<string | null>(null);
  const [vendorTaskSuggestions, setVendorTaskSuggestions] = useState<Record<string, VendorTaskSuggestion[]>>({});
  const [vendorTaskSuggestionsLoadingId, setVendorTaskSuggestionsLoadingId] = useState<string | null>(null);
  const [resolvingVendorTaskSuggestionId, setResolvingVendorTaskSuggestionId] = useState<string | null>(null);
  const [acceptedVendorTaskSuggestionId, setAcceptedVendorTaskSuggestionId] = useState<string | null>(null);
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
    if (isPlanner && !plannerClientHydrating && !selectedClient) navigate('/clients');
  }, [isPlanner, plannerClientHydrating, selectedClient, navigate]);

  const activeWeddingId = isPlanner
    ? selectedClient?.wedding_id ?? entitlementWeddingId
    : entitlementWeddingId;

  const vendorsQueryKey = ['vendors', user?.id ?? null, selectedClient?.id ?? null, dataOrFilter ?? null] as const;
  const vendorsQuery = useQuery({
    queryKey: vendorsQueryKey,
    queryFn: async () => {
      if (!dataOrFilter) return { categories: [], vendors: [], vendorTasks: [], vendorPayments: [] } as VendorsWorkspaceData;
      return loadVendorsWorkspace(dataOrFilter);
    },
    enabled: Boolean(dataOrFilter),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (vendorsQuery.error) {
      toast({
        title: 'Failed to load vendor workspace',
        description: vendorsQuery.error instanceof Error ? vendorsQuery.error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [toast, vendorsQuery.error]);

  const vendors = vendorsQuery.data?.vendors ?? emptyVendors;
  const vendorTasksByVendorId = useMemo(
    () => Object.fromEntries(
      vendors.map((vendor) => [
        vendor.id,
        getRelatedTasksForVendor(vendor, vendorsQuery.data?.vendorTasks ?? []),
      ]),
    ) as Record<string, VendorTaskItem[]>,
    [vendors, vendorsQuery.data?.vendorTasks],
  );
  const vendorPaymentsByVendorId = useMemo(
    () =>
      (vendorsQuery.data?.vendorPayments ?? []).reduce((summary, payment) => {
        if (!payment.vendor_id) return summary;
        summary[payment.vendor_id] = [...(summary[payment.vendor_id] ?? []), payment];
        return summary;
      }, {} as Record<string, VendorPaymentRecord[]>),
    [vendorsQuery.data?.vendorPayments],
  );

  const refreshVendorsWorkspace = async () => {
    await queryClient.invalidateQueries({ queryKey: vendorsQueryKey });
  };

  const openVendorContactEditor = (vendor: Vendor, createClaimAfterSave = false) => {
    setContactEditorVendor(vendor);
    setContactEditorForm({
      email: vendor.email ?? '',
      phone: vendor.phone ?? '',
    });
    setContactEditorErrors({});
    setContactEditorSubmitError(null);
    setCreateClaimAfterContactSave(createClaimAfterSave);
  };

  const saveWorkspaceVendorInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVendor || selectedVendor.vendor_listing_id || !activeWeddingId) return;

    const email = workspaceInviteForm.email.trim();
    const phone = workspaceInviteForm.phone.trim();
    if (!email && !phone) {
      setWorkspaceInviteError('Add an email address or phone number before saving this invite.');
      return;
    }

    setWorkspaceInviteSubmittingVendorId(selectedVendor.id);
    setWorkspaceInviteError(null);

    try {
      const expiresAt = workspaceInviteForm.expiresAt
        ? new Date(`${workspaceInviteForm.expiresAt}T23:59:59`).toISOString()
        : null;

      const existingInvite = selectedVendorActiveInvite;
      const savedInvite = existingInvite
        ? await updateWorkspaceVendorInvite(existingInvite.id, {
            invite_contact_email: email || null,
            invite_contact_phone: phone || null,
            invite_message: workspaceInviteForm.message.trim() || null,
            invite_expires_at: expiresAt,
          })
        : await createWorkspaceVendorInviteDraft({
            weddingId: activeWeddingId,
            vendorId: selectedVendor.id,
            inviteContactEmail: email || null,
            inviteContactPhone: phone || null,
            inviteMessage: workspaceInviteForm.message.trim() || null,
            inviteExpiresAt: expiresAt,
          });

      setWorkspaceVendorInvites((current) => {
        const previous = current[selectedVendor.id] ?? [];
        const next = existingInvite
          ? previous.map((invite) => (invite.id === savedInvite.id ? savedInvite : invite))
          : [savedInvite, ...previous];
        return { ...current, [selectedVendor.id]: next };
      });

      toast({
        title: existingInvite ? 'Vendor invite updated' : 'Vendor invite draft created',
        description: existingInvite
          ? 'This vendor collaboration invite is ready for the next delivery step.'
          : 'Zania saved the invite details for this private vendor record. Nothing becomes public unless the vendor later joins and opts in.',
      });
    } catch (error: any) {
      setWorkspaceInviteError(error?.message || 'Could not save this vendor invite right now.');
      toast({
        title: 'Could not save vendor invite',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setWorkspaceInviteSubmittingVendorId(null);
    }
  };

  const createQuickVendorClaimLink = async (vendor: Vendor) => {
    if (vendor.vendor_listing_id || !activeWeddingId) return;
    if (!vendor.email && !vendor.phone) {
      openVendorContactEditor(vendor, true);
      return;
    }

    setWorkspaceInviteSubmittingVendorId(vendor.id);
    setWorkspaceInviteError(null);
    try {
      const savedInvite = await createWorkspaceVendorInviteDraft({
        weddingId: activeWeddingId,
        vendorId: vendor.id,
        inviteContactEmail: vendor.email,
        inviteContactPhone: vendor.phone,
      });
      setWorkspaceVendorInvites((current) => ({
        ...current,
        [vendor.id]: [savedInvite, ...(current[vendor.id] ?? [])],
      }));
      toast({
        title: 'Vendor claim link ready',
        description: `The private Zania claim link for ${vendor.name} is ready to share.`,
      });
    } catch (error: any) {
      setWorkspaceInviteError(error?.message || 'Could not create this vendor claim link right now.');
      toast({
        title: 'Could not create claim link',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setWorkspaceInviteSubmittingVendorId(null);
    }
  };

  const saveVendorContact = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contactEditorVendor || profile?.role !== 'couple') return;

    const email = contactEditorForm.email.trim().toLowerCase();
    const phone = contactEditorForm.phone.trim();
    const nextErrors: { email?: string; phone?: string } = {};
    if (!email && !phone) {
      nextErrors.email = 'Add an email address or phone number.';
    } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (phone && !/^[\d+\s()-]{7,}$/.test(phone)) {
      nextErrors.phone = 'Enter a valid phone number.';
    }
    setContactEditorErrors(nextErrors);
    setContactEditorSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    const vendor = contactEditorVendor;
    const shouldCreateClaim = createClaimAfterContactSave;
    setSavingVendorContact(true);

    try {
      const { error } = await supabase
        .from('vendors')
        .update({ email: email || null, phone: phone || null })
        .eq('id', vendor.id);
      if (error) throw error;

      const activeInvite = (workspaceVendorInvites[vendor.id] ?? []).find((invite) =>
        ['draft', 'pending', 'sent', 'opened'].includes(invite.invite_status),
      ) ?? null;
      if (activeInvite) {
        const updatedInvite = await updateWorkspaceVendorInvite(activeInvite.id, {
          invite_contact_email: email || null,
          invite_contact_phone: phone || null,
        });
        setWorkspaceVendorInvites((current) => ({
          ...current,
          [vendor.id]: (current[vendor.id] ?? []).map((invite) =>
            invite.id === updatedInvite.id ? updatedInvite : invite,
          ),
        }));
      }

      await refreshVendorsWorkspace();
      setContactEditorVendor(null);
      setCreateClaimAfterContactSave(false);

      if (shouldCreateClaim && !activeInvite) {
        await createQuickVendorClaimLink({ ...vendor, email: email || null, phone: phone || null });
      } else {
        toast({
          title: 'Vendor contact saved',
          description: `${vendor.name}'s contact details are ready for invitations and follow-ups.`,
        });
      }
    } catch (error: any) {
      setContactEditorSubmitError(error?.message || 'Could not save these vendor contact details right now.');
    } finally {
      setSavingVendorContact(false);
    }
  };

  const sendWorkspaceVendorInviteEmail = async () => {
    if (!selectedVendor || !selectedVendorActiveInvite) return;

    setWorkspaceInviteSubmittingVendorId(selectedVendor.id);
    setWorkspaceInviteError(null);

    try {
      const { error } = await supabase.functions.invoke('send-workspace-vendor-invite', {
        body: {
          inviteId: selectedVendorActiveInvite.id,
        },
      });

      if (error) throw error;

      const refreshedInvite = await updateWorkspaceVendorInvite(selectedVendorActiveInvite.id, {
        invite_status: 'sent',
        invite_sent_at: new Date().toISOString(),
      });

      setWorkspaceVendorInvites((current) => ({
        ...current,
        [selectedVendor.id]: (current[selectedVendor.id] ?? []).map((invite) =>
          invite.id === refreshedInvite.id ? refreshedInvite : invite,
        ),
      }));

      toast({
        title: 'Vendor invite sent',
        description: `${selectedVendor.name} now has a claim link in their email inbox.`,
      });
    } catch (error: any) {
      setWorkspaceInviteError(error?.message || 'Could not send this vendor invite email right now.');
      toast({
        title: 'Could not send vendor invite',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setWorkspaceInviteSubmittingVendorId(null);
    }
  };

  useEffect(() => {
    if (!vendors.length) {
      setPriceDrafts({});
      setPaymentDrafts({});
      setWorkflowDrafts({});
      setNotesDrafts({});
      setVendorDetailsDrafts({});
      return;
    }

    setPriceDrafts(Object.fromEntries(vendors.map((row) => [row.id, row.price != null ? String(row.price) : ''])));
    setPaymentDrafts(
      Object.fromEntries(
        vendors.map((row) => [
          row.id,
          {
            depositAmount: String(row.deposit_amount ?? 0),
            paymentStatus: (row.payment_status || 'unpaid') as VendorPaymentStatus,
            paymentDueDate: row.payment_due_date ?? '',
          },
        ]),
      ),
    );
    setWorkflowDrafts(
      Object.fromEntries(
        vendors.map((row) => [
          row.id,
          {
            committeeRoleInCharge: row.committee_role_in_charge ?? 'unassigned',
            contractStatus: row.contract_status ?? 'not_started',
          },
        ]),
      ),
    );
    setNotesDrafts(Object.fromEntries(vendors.map((row) => [row.id, row.notes ?? ''])));
    setVendorDetailsDrafts(
      Object.fromEntries(
        vendors.map((row) => [
          row.id,
          {
            name: row.name,
            category: row.category,
            email: row.email ?? '',
            phone: row.phone ?? '',
          },
        ]),
      ),
    );
  }, [vendors]);

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
    if (profile?.role !== 'planner' && profile?.role !== 'admin') {
      setCategoryReputationBenchmarks({});
      setListingReputationBenchmarks({});
      setReviewsBySourceVendorId({});
      return;
    }

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
  }, [vendors, selectedClient?.id, profile?.role]);

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

  useEffect(() => {
    if (!open || mode !== 'directory' || directoryPool.length) return;

    let active = true;
    const fetchDirectory = async () => {
      setDirLoading(true);
      try {
        const { data } = await supabase
          .from('vendor_listings')
          .select('id, business_name, category, phone, email, location, is_verified')
          .eq('is_approved', true)
          .order('business_name')
          .limit(200);

        if (active) setDirectoryPool((data as DirectoryVendor[]) || []);
      } finally {
        if (active) setDirLoading(false);
      }
    };

    void fetchDirectory();
    return () => {
      active = false;
    };
  }, [open, mode, directoryPool.length]);

  useEffect(() => {
    if (mode !== 'directory') return;
    const query = dirSearch.trim().toLowerCase();
    if (query.length < 2) {
      setDirResults([]);
      return;
    }

    const nextResults = directoryPool
      .filter((vendor) => {
        const haystack = [vendor.business_name, vendor.category, vendor.location ?? '']
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 20);

    setDirResults(nextResults);
  }, [dirSearch, directoryPool, mode]);

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
    if (activeWeddingId) insert.wedding_id = activeWeddingId;

    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'vendors',
          changeType: 'create',
          proposedPayload: {
            name: insert.name,
            category: insert.category,
            phone: insert.phone,
            price: insert.price,
            status: insert.status,
            vendor_listing_id: insert.vendor_listing_id,
            wedding_id: insert.wedding_id ?? null,
          },
        });
        toast({
          title: 'Vendor request sent for approval',
          description: `${dv.business_name} will appear after the couple approves it.`,
        });
        setOpen(false);
        setDirSearch('');
        setDirResults([]);
      } catch (error: any) {
        toast({ title: 'Could not submit vendor request', description: error?.message, variant: 'destructive' });
      }
      return;
    }

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
    await refreshVendorsWorkspace();
  };

  const addVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const nextErrors: { name?: string; email?: string; phone?: string; price?: string } = {};
    if (!form.name.trim()) nextErrors.name = 'Enter the business name before saving the vendor.';
    if (!form.email.trim()) {
      nextErrors.email = 'Enter an email address so this vendor can receive an invite later.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (form.phone.trim() && !/^[\d+\s()-]{7,}$/.test(form.phone.trim())) nextErrors.phone = 'Enter a valid phone number or leave it blank.';
    if (form.price.trim() && (!Number.isFinite(parseFloat(form.price)) || parseFloat(form.price) < 0)) nextErrors.price = 'Enter a valid quoted price in KES.';
    setVendorFormErrors(nextErrors);
    setVendorSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setAddingVendor(true);

    const insert: Record<string, unknown> = {
      user_id: user.id,
      name: form.name.trim(),
      category: form.category,
      email: form.email.trim().toLowerCase(),
      phone: form.phone || null,
      price: form.price ? parseFloat(form.price) : null,
      status: form.price ? 'quoted' : 'contacted',
    };

    if (isPlanner && selectedClient) insert.client_id = selectedClient.id;
    if (activeWeddingId) insert.wedding_id = activeWeddingId;

    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'vendors',
          changeType: 'create',
          proposedPayload: {
            name: insert.name,
            category: insert.category,
            email: insert.email,
            phone: insert.phone,
            price: insert.price,
            status: insert.status,
            wedding_id: insert.wedding_id ?? null,
          },
        });
        setForm({ name: '', category: 'Wedding Venue', email: '', phone: '', price: '' });
        setOpen(false);
        toast({
          title: 'Vendor request sent for approval',
          description: 'The couple will review this vendor before it goes live.',
        });
      } catch (error: any) {
        setVendorSubmitError(error?.message || 'We could not submit this vendor for approval.');
        toast({ title: 'Could not submit vendor request', description: error?.message, variant: 'destructive' });
      } finally {
        setAddingVendor(false);
      }
      return;
    }

    const { error } = await supabase.from('vendors').insert(insert);
    if (error) {
      setVendorSubmitError(error.message || 'We could not save this vendor right now.');
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setAddingVendor(false);
      return;
    }

    setForm({ name: '', category: 'Wedding Venue', email: '', phone: '', price: '' });
    setOpen(false);
    await refreshVendorsWorkspace();
    setAddingVendor(false);
  };

  const updateStatus = async (vendor: Vendor, status: string) => {
    setSavingStatusId(vendor.id);
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        const updates: Record<string, unknown> = { status };
        if (status === 'rejected') updates.selection_status = 'declined';
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'vendors',
          changeType: 'update',
          targetId: vendor.id,
          currentPayload: vendor as unknown as Record<string, unknown>,
          proposedPayload: updates,
        });
        toast({
          title: 'Vendor status sent for approval',
          description: `${vendor.name} will update after the couple approves it.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit vendor update', description: error?.message, variant: 'destructive' });
      }
      setSavingStatusId(null);
      return;
    }
    const updates: Record<string, unknown> = { status };
    if (status === 'rejected') updates.selection_status = 'declined';
    const { error } = await supabase.from('vendors').update(updates).eq('id', vendor.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      if (vendor.wedding_id && (status === 'booked' || vendor.status === 'booked')) {
        await recalculatePlanningExperiment(vendor.wedding_id);
      }
      await refreshVendorsWorkspace();
    }
    setSavingStatusId(null);
  };

  const updateVendorDetails = async (vendor: Vendor) => {
    const draft = vendorDetailsDrafts[vendor.id];
    if (!draft) return;

    const name = draft.name.trim();
    const email = draft.email.trim();
    const phone = draft.phone.trim();
    if (!name) {
      toast({
        title: 'Vendor name is required',
        description: 'Add the business or vendor name before saving.',
        variant: 'destructive',
      });
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: 'Check the email address',
        description: 'Enter a complete email address or leave the field empty.',
        variant: 'destructive',
      });
      return;
    }

    const updates = {
      name,
      category: draft.category,
      email: email || null,
      phone: phone || null,
    };
    setSavingVendorDetailsId(vendor.id);

    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'vendors',
          changeType: 'update',
          targetId: vendor.id,
          currentPayload: {
            name: vendor.name,
            category: vendor.category,
            email: vendor.email,
            phone: vendor.phone,
          },
          proposedPayload: updates,
        });
        toast({
          title: 'Vendor details sent for approval',
          description: `${vendor.name}'s details will update after the couple approves them.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit vendor details', description: error?.message, variant: 'destructive' });
      } finally {
        setSavingVendorDetailsId(null);
      }
      return;
    }

    const { error } = await supabase.from('vendors').update(updates).eq('id', vendor.id);
    if (error) {
      toast({ title: 'Could not save vendor details', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vendor details saved', description: `${name} is up to date.` });
      await refreshVendorsWorkspace();
    }
    setSavingVendorDetailsId(null);
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
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'vendors',
          changeType: 'update',
          targetId: vendor.id,
          currentPayload: { price: vendor.price },
          proposedPayload: { price: nextPrice },
        });
        toast({
          title: 'Vendor price sent for approval',
          description: `${vendor.name}'s price will update after the couple approves it.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit vendor price update', description: error?.message, variant: 'destructive' });
      }
      setSavingPriceId(null);
      return;
    }
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
      await refreshVendorsWorkspace();
    }
    setSavingPriceId(null);
  };

  const updateVendorPayment = async (vendor: Vendor) => {
    const draft = paymentDrafts[vendor.id];
    if (!draft) return;

    const contractAmountDraft = priceDrafts[vendor.id]?.trim() ?? '';
    const contractAmount = contractAmountDraft === '' ? null : Number(contractAmountDraft);
    const depositAmount = draft.depositAmount.trim() === '' ? 0 : Number(draft.depositAmount);
    const amountPaid = totalRecordedVendorPayments(vendorPaymentsByVendorId[vendor.id] ?? []);
    const paymentStatus = deriveVendorPaymentStatus({
      totalCost: contractAmount,
      depositRequired: depositAmount,
      totalPaid: amountPaid,
    });

    if (contractAmountDraft !== '' && (!Number.isFinite(contractAmount) || (contractAmount ?? 0) <= 0)) {
      toast({
        title: 'Invalid contract amount',
        description: 'Enter a valid KES amount greater than zero.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(depositAmount) || depositAmount < 0) {
      toast({
        title: 'Invalid deposit amount',
        description: 'The agreed deposit must be zero or higher.',
        variant: 'destructive',
      });
      return;
    }

    setSavingPaymentId(vendor.id);
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'vendors',
          changeType: 'update',
          targetId: vendor.id,
          currentPayload: vendor as unknown as Record<string, unknown>,
          proposedPayload: {
            price: contractAmount,
            deposit_amount: depositAmount,
            amount_paid: amountPaid,
            payment_status: paymentStatus,
            payment_due_date: draft.paymentDueDate || null,
          },
        });
        toast({
          title: 'Vendor payment plan sent for approval',
          description: `${vendor.name}'s payment state will update after the couple approves it.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit vendor payment update', description: error?.message, variant: 'destructive' });
      } finally {
        setSavingPaymentId(null);
      }
      return;
    }
    try {
      await updateVendorPaymentState({
        vendorId: vendor.id,
        contractAmount,
        depositAmount,
        amountPaid,
        paymentStatus,
        paymentDueDate: draft.paymentDueDate || null,
      });

      toast({
        title: 'Payment plan updated',
        description: draft.paymentDueDate
          ? `${vendor.name} now shows ${vendorPaymentStatusLabel(paymentStatus).toLowerCase()}, with a payment reminder scheduled.`
          : `${vendor.name} now shows ${vendorPaymentStatusLabel(paymentStatus).toLowerCase()}.`,
      });
      await refreshVendorsWorkspace();
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
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      const vendor = vendors.find((item) => item.id === id);
      if (!vendor) return;
      await submitPlannerChangeRequest({
        clientId: selectedClient.id,
        coupleUserId: selectedClient.linked_user_id,
        plannerUserId: user!.id,
        targetTable: 'vendors',
        changeType: 'delete',
        targetId: id,
        currentPayload: vendor as unknown as Record<string, unknown>,
        proposedPayload: { name: vendor.name, category: vendor.category },
      });
      toast({
        title: 'Vendor removal sent for approval',
        description: `${vendor.name} will only be removed if the couple approves it.`,
      });
      return;
    }
    const vendor = vendors.find((item) => item.id === id);
    if (!vendor) return;
    const wasSelected = selectedVendorId === id;
    if (wasSelected) setSelectedVendorId(null);
    scheduleDelete({
      id,
      title: 'Vendor removed',
      description: `${vendor.name} was removed from the wedding workspace.`,
      commit: async () => {
        const { error } = await supabase.from('vendors').delete().eq('id', id);
        if (error) throw error;
      },
      onCommit: refreshVendorsWorkspace,
      onUndo: () => {
        if (wasSelected) setSelectedVendorId(id);
      },
    });
  };

  const updateSelection = async (vendor: Vendor, selectionStatus: VendorSelectionStatus) => {
    if (selectionStatus === 'final' && !hasRecordedVendor(vendor)) {
      toast({
        title: 'Add a vendor first',
        description: `Record or link a ${vendor.category.toLowerCase()} vendor before choosing a final option.`,
      });
      return;
    }
    setSelectionSucceededId(null);
    setSavingSelectionId(vendor.id);
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'vendors',
          changeType: 'update',
          targetId: vendor.id,
          currentPayload: { selection_status: vendor.selection_status },
          proposedPayload: { selection_status: selectionStatus },
        });
        toast({
          title: 'Vendor decision sent for approval',
          description: `${vendor.name}'s selection state will update after the couple approves it.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit vendor decision', description: error?.message, variant: 'destructive' });
      } finally {
        setSavingSelectionId(null);
      }
      return;
    }
    try {
      await setVendorSelectionStatus(vendor.id, selectionStatus);
      setSelectionSucceededId(vendor.id);
      toast({
        title: selectionStatus === 'final' ? 'Final vendor selected' : 'Vendor selection updated',
        description:
          selectionStatus === 'final'
            ? `${vendor.name} is now your final ${vendor.category.toLowerCase()} choice.`
            : `${vendor.name} is now marked as ${vendorSelectionLabel(selectionStatus).toLowerCase()}.`,
      });
      await refreshVendorsWorkspace();
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

  const updateVendorWorkflow = async (vendor: Vendor) => {
    const draft = workflowDrafts[vendor.id];
    if (!draft) return;

    setSavingWorkflowId(vendor.id);
    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'vendors',
          changeType: 'update',
          targetId: vendor.id,
          currentPayload: vendor as unknown as Record<string, unknown>,
          proposedPayload: {
            committee_role_in_charge: draft.committeeRoleInCharge === 'unassigned' ? null : draft.committeeRoleInCharge,
          },
        });
        toast({
          title: 'Vendor workflow sent for approval',
          description: `${vendor.name} changes are waiting for couple approval.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit workflow update', description: error?.message, variant: 'destructive' });
      }
      setSavingWorkflowId(null);
      return;
    }
    const { error } = await supabase
      .from('vendors')
      .update({
        committee_role_in_charge: draft.committeeRoleInCharge === 'unassigned' ? null : draft.committeeRoleInCharge,
      })
      .eq('id', vendor.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Vendor workflow updated',
        description: `${vendor.name} now tracks owner and contract status.`,
      });
      await refreshVendorsWorkspace();
    }
    setSavingWorkflowId(null);
  };

  const resetVendorTaskForm = () => {
    setVendorTaskTemplateKey('none');
    setVendorTaskFormErrors({});
    setVendorTaskSubmitError(null);
    setVendorTaskForm({
      title: '',
      description: '',
      dueDate: '',
      assignedTo: '',
    });
  };

  const submitVendorTask = async (vendor: Vendor) => {
    if (!user) return;
    const nextErrors: { title?: string } = {};
    if (!vendorTaskForm.title.trim()) nextErrors.title = 'Add a task title before saving.';
    setVendorTaskFormErrors(nextErrors);
    setVendorTaskSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setVendorTaskSubmitting(true);
    try {
      if (plannerNeedsApproval && selectedClient?.linked_user_id) {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'tasks',
          changeType: 'create',
          proposedPayload: {
            title: vendorTaskForm.title.trim(),
            description: vendorTaskForm.description.trim() || null,
            due_date: vendorTaskForm.dueDate || null,
            assigned_to: vendorTaskForm.assignedTo.trim() || null,
            category: vendor.category,
            source_vendor_id: vendor.id,
            phase: selectedVendorTaskTemplate?.phase ?? null,
            visibility: resolvedVendorTaskDefaults?.visibility ?? 'public',
            delegatable: resolvedVendorTaskDefaults?.delegatable ?? false,
            recommended_role: resolvedVendorTaskDefaults?.recommendedRole ?? null,
            priority_level: resolvedVendorTaskDefaults?.priorityLevel ?? null,
            template_source: selectedVendorTaskTemplate?.key
              ? 'vendor_task_picker_v1'
              : resolvedVendorTaskDefaults
                ? 'vendor_category_defaults_v1'
                : null,
            completed: false,
          },
        });
        toast({
          title: 'Vendor task sent for approval',
          description: `${vendor.name}'s linked task will go live after the couple approves it.`,
        });
      } else {
        await createVendorTask({
          userId: user.id,
          title: vendorTaskForm.title.trim(),
          description: vendorTaskForm.description.trim() || null,
          dueDate: vendorTaskForm.dueDate || null,
          assignedTo: vendorTaskForm.assignedTo.trim() || null,
          category: vendor.category,
          clientId: selectedClient?.id ?? null,
          sourceVendorId: vendor.id,
          phase: selectedVendorTaskTemplate?.phase ?? null,
          visibility: resolvedVendorTaskDefaults?.visibility ?? 'public',
          delegatable: resolvedVendorTaskDefaults?.delegatable ?? false,
          recommendedRole: resolvedVendorTaskDefaults?.recommendedRole ?? null,
          priorityLevel: resolvedVendorTaskDefaults?.priorityLevel ?? null,
          templateSource: selectedVendorTaskTemplate?.key
            ? 'vendor_task_picker_v1'
            : resolvedVendorTaskDefaults
              ? 'vendor_category_defaults_v1'
              : null,
        });
        toast({
          title: 'Vendor task created',
          description: `${vendor.name} now has a linked planning task.`,
        });
      }
      resetVendorTaskForm();
      setVendorTaskDialogVendor(null);
      await refreshVendorsWorkspace();
    } catch (error: any) {
      setVendorTaskSubmitError(error.message || 'We could not create this vendor task right now.');
      toast({
        title: 'Failed to create vendor task',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setVendorTaskSubmitting(false);
    }
  };

  const updateVendorNotes = async (vendor: Vendor) => {
    const nextNotes = (notesDrafts[vendor.id] ?? '').trim();
    setSavingNotesId(vendor.id);

    if (plannerNeedsApproval && selectedClient?.linked_user_id) {
      try {
        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user!.id,
          targetTable: 'vendors',
          changeType: 'update',
          targetId: vendor.id,
          currentPayload: { notes: vendor.notes },
          proposedPayload: { notes: nextNotes || null },
        });
        toast({
          title: 'Vendor notes sent for approval',
          description: `Comparison notes for ${vendor.name} are waiting for couple approval.`,
        });
      } catch (error: any) {
        toast({ title: 'Could not submit vendor notes', description: error?.message, variant: 'destructive' });
      }
      setSavingNotesId(null);
      return;
    }

    const { error } = await supabase
      .from('vendors')
      .update({ notes: nextNotes || null })
      .eq('id', vendor.id);

    if (error) {
      toast({
        title: 'Failed to save decision notes',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Decision notes saved',
        description: `Comparison notes for ${vendor.name} were updated.`,
      });
      await refreshVendorsWorkspace();
    }

    setSavingNotesId(null);
  };

  const sendVendorQuoteRequest = async (vendor: Vendor) => {
    if (!vendor.vendor_listing_id) {
      toast({
        title: 'Connect the vendor first',
        description: 'This vendor needs a professional Zania account before they can receive quote requests.',
        variant: 'destructive',
      });
      return;
    }

    setRequestingQuoteVendorId(vendor.id);
    try {
      await requestVendorQuote(vendor.id, {
        message: `Please send a quote for ${vendor.category}.`,
        budgetAmount: vendor.price,
      });
      toast({
        title: 'Quote requested',
        description: `${vendor.name} will see this request at the top of their document desk.`,
      });
    } catch (error) {
      console.error('Could not request vendor quote:', error);
      toast({
        title: 'Could not request quote',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRequestingQuoteVendorId(null);
    }
  };

  const buildVendorTaskBundle = async (vendor: Vendor) => {
    if (!user) return;
    if (plannerNeedsApproval) {
      toast({
        title: 'Use individual task requests for linked weddings',
        description: 'Auto-building vendor task bundles is disabled here so the couple can review each planner task separately.',
        variant: 'destructive',
      });
      return;
    }
    setCreatingVendorTaskBundleId(vendor.id);
    try {
      const created = await createVendorTaskBundle({
        userId: user.id,
        vendorId: vendor.id,
        vendorName: vendor.name,
        category: vendor.category,
        clientId: selectedClient?.id ?? null,
        paymentDueDate: paymentDrafts[vendor.id]?.paymentDueDate ?? vendor.payment_due_date,
      });
      toast({
        title: created.length ? 'Vendor task bundle created' : 'Vendor task bundle already exists',
        description: created.length
          ? `${created.length} linked tasks were added for ${vendor.name}.`
          : `No new tasks were needed for ${vendor.name}.`,
      });
      await refreshVendorsWorkspace();
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

  const visibleVendors = useMemo(
    () => vendors.filter((vendor) => !pendingDeleteIds.has(vendor.id)),
    [pendingDeleteIds, vendors],
  );

  const sortedVendors = useMemo(
    () =>
      [...visibleVendors].sort((left, right) => {
        const categoryCompare = left.category.localeCompare(right.category);
        if (categoryCompare !== 0) return categoryCompare;

        const selectionCompare =
          (selectionSortOrder[left.selection_status ?? 'shortlisted'] ?? 99) -
          (selectionSortOrder[right.selection_status ?? 'shortlisted'] ?? 99);
        if (selectionCompare !== 0) return selectionCompare;

        return left.name.localeCompare(right.name);
      }),
    [visibleVendors],
  );

  const selectionCounts = useMemo(() => {
    return vendors.reduce(
      (summary, vendor) => {
        const key = (isChosenVendor(vendor) ? 'final' : vendor.selection_status === 'final' ? 'shortlisted' : vendor.selection_status || 'shortlisted') as VendorSelectionStatus;
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
    () => sortedVendors.filter(isChosenVendor),
    [sortedVendors],
  );

  const finalVendorPaymentSummary = useMemo(() => {
    const totalContract = finalVendorEntries.reduce((sum, vendor) => sum + (vendor.price ?? 0), 0);
    const totalPaid = finalVendorEntries.reduce(
      (sum, vendor) => sum + totalRecordedVendorPayments(vendorPaymentsByVendorId[vendor.id] ?? []),
      0,
    );
    const totalOutstanding = finalVendorEntries.reduce(
      (sum, vendor) => sum + Math.max(
        (vendor.price ?? 0) - totalRecordedVendorPayments(vendorPaymentsByVendorId[vendor.id] ?? []),
        0,
      ),
      0,
    );

    return { totalContract, totalPaid, totalOutstanding };
  }, [finalVendorEntries, vendorPaymentsByVendorId]);

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

  const nextVendorFollowUpTask = useMemo(() => {
    const uniqueTasks = new Map<string, VendorTaskItem>();
    Object.values(vendorTasksByVendorId)
      .flat()
      .filter((task) => !task.completed)
      .forEach((task) => uniqueTasks.set(task.id, task));

    return [...uniqueTasks.values()].sort((left, right) => {
      if (!left.due_date && !right.due_date) return left.title.localeCompare(right.title);
      if (!left.due_date) return 1;
      if (!right.due_date) return -1;
      return left.due_date.localeCompare(right.due_date);
    })[0] ?? null;
  }, [vendorTasksByVendorId]);

  const vendorConfirmationSummary = useMemo(() => {
    const categoriesToConfirm = new Set(vendorsQuery.data?.categories ?? []);
    const confirmedCategories = new Set(
      finalVendorEntries
        .map((vendor) => vendor.category)
        .filter((category) => categoriesToConfirm.has(category)),
    );

    return {
      total: categoriesToConfirm.size,
      confirmed: confirmedCategories.size,
      pending: Math.max(categoriesToConfirm.size - confirmedCategories.size, 0),
    };
  }, [finalVendorEntries, vendorsQuery.data?.categories]);

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
        return activeVendors.length > 0 && !activeVendors.some(isChosenVendor);
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

  const isCommitteeWorkspace = profile?.role === 'planner' && profile?.planner_type === 'committee';
  const showSharedVendorWorkspace =
    profile?.role === 'couple' || isCommitteeWorkspace || Boolean(selectedClient);
  const exportFeature = profile?.role === 'planner'
    ? profile?.planner_type === 'committee'
      ? 'committee.export_progress'
      : 'planner.export_progress'
    : 'couple.export_progress';
  const exportDecision = getEntitlementDecision(exportFeature, { profile, weddingEntitlements, couplePlanTier });

  const vendorWorkspaceVendors = useMemo(() => {
    const query = vendorWorkspaceQuery.trim().toLowerCase();
    if (!query) return sortedVendors;

    return sortedVendors.filter((vendor) => {
      const vendorText = [
        vendor.name,
        vendor.category,
        vendor.phone ?? '',
        vendor.email ?? '',
        vendorSelectionLabel((vendor.selection_status || 'shortlisted') as VendorSelectionStatus),
        vendorPaymentStatusLabel((vendor.payment_status || 'unpaid') as VendorPaymentStatus),
      ]
        .join(' ')
        .toLowerCase();

      return vendorText.includes(query);
    });
  }, [sortedVendors, vendorWorkspaceQuery]);

  const vendorsGroupedByCategory = useMemo(() => {
    const categories = vendorWorkspaceQuery.trim()
      ? []
      : (vendorsQuery.data?.categories ?? []);
    const initialGroups = Object.fromEntries(
      categories.map((category) => [category, [] as Vendor[]]),
    ) as Record<string, Vendor[]>;

    return vendorWorkspaceVendors.reduce<Record<string, Vendor[]>>((summary, vendor) => {
      summary[vendor.category] = [...(summary[vendor.category] ?? []), vendor];
      return summary;
    }, initialGroups);
  }, [vendorWorkspaceQuery, vendorWorkspaceVendors, vendorsQuery.data?.categories]);

  const visibleVendorCategoryEntries = useMemo(() => {
    const entries = Object.entries(vendorsGroupedByCategory);
    if (vendorWorkspaceQuery.trim() || showEmptyVendorCategories) return entries;
    return entries.filter(([, group]) => group.length > 0);
  }, [showEmptyVendorCategories, vendorWorkspaceQuery, vendorsGroupedByCategory]);

  const hiddenEmptyVendorCategoryCount = useMemo(
    () => Object.values(vendorsGroupedByCategory).filter((group) => group.length === 0).length,
    [vendorsGroupedByCategory],
  );

  const filteredVendorsByName = useMemo(
    () => [...vendorWorkspaceVendors].sort((left, right) => left.name.localeCompare(right.name)),
    [vendorWorkspaceVendors],
  );

  const selectedVendor = useMemo(
    () => visibleVendors.find((vendor) => vendor.id === selectedVendorId) ?? null,
    [selectedVendorId, visibleVendors],
  );

  const selectedVendorContractQuery = useQuery({
    queryKey: ['couple-vendor-contract', selectedVendorId],
    queryFn: () => getCoupleVendorContract(selectedVendorId!),
    enabled: Boolean(showSharedVendorWorkspace && selectedVendorId),
    staleTime: 30_000,
  });

  const vendorTaskSuggestedOptions = useMemo(() => {
    if (!vendorTaskDialogVendor) return [];
    return getSuggestedTaskTemplates({
      category: vendorTaskDialogVendor.category,
      vendorCategories: vendors.map((vendor) => vendor.category),
      role: profile?.role,
      plannerType: profile?.planner_type,
    });
  }, [vendorTaskDialogVendor, vendors, profile?.role, profile?.planner_type]);

  const selectedVendorTaskTemplate = useMemo(() => {
    if (vendorTaskTemplateKey === 'none') return null;
    return vendorTaskSuggestedOptions.find((template) => template.key === vendorTaskTemplateKey) ?? null;
  }, [vendorTaskTemplateKey, vendorTaskSuggestedOptions]);

  const resolvedVendorTaskDefaults = useMemo(() => {
    if (selectedVendorTaskTemplate) {
      return {
        visibility: selectedVendorTaskTemplate.visibility,
        delegatable: selectedVendorTaskTemplate.delegatable,
        recommendedRole: selectedVendorTaskTemplate.recommendedRole,
        priorityLevel: selectedVendorTaskTemplate.priorityLevel,
      };
    }

    if (!vendorTaskDialogVendor) return null;
    return getTaskCategoryDefaults({
      category: vendorTaskDialogVendor.category,
      role: profile?.role,
      plannerType: profile?.planner_type,
    });
  }, [selectedVendorTaskTemplate, vendorTaskDialogVendor, profile?.role, profile?.planner_type]);

  const selectedVendorTasks = useMemo(() => {
    if (!selectedVendorId) return [];
    return vendorTasksByVendorId[selectedVendorId] ?? [];
  }, [selectedVendorId, vendorTasksByVendorId]);

  const selectedVendorPayments = useMemo(() => {
    if (!selectedVendorId) return [];
    return vendorPaymentsByVendorId[selectedVendorId] ?? [];
  }, [selectedVendorId, vendorPaymentsByVendorId]);
  const selectedVendorInvites = useMemo(() => {
    if (!selectedVendorId) return [];
    return workspaceVendorInvites[selectedVendorId] ?? [];
  }, [selectedVendorId, workspaceVendorInvites]);
  const selectedVendorActiveInvite = useMemo(
    () => selectedVendorInvites.find((invite) => ['draft', 'pending', 'sent', 'opened'].includes(invite.invite_status)) ?? null,
    [selectedVendorInvites],
  );

  const selectedVendorTaskCounts = useMemo(() => {
    const open = selectedVendorTasks.filter((task) => !task.completed);
    const completed = selectedVendorTasks.filter((task) => task.completed);
    return { open, completed };
  }, [selectedVendorTasks]);

  const selectedVendorMilestones = useMemo(() => {
    if (!selectedVendor || !hasRecordedVendor(selectedVendor)) return [];
    return buildVendorMilestones(selectedVendor, selectedVendorTasks);
  }, [selectedVendor, selectedVendorTasks]);

  const selectedVendorNextMilestone = useMemo(
    () => selectedVendorMilestones.find((milestone) => milestone.status !== 'complete') ?? null,
    [selectedVendorMilestones],
  );

  const selectedVendorCompletedMilestones = useMemo(
    () => selectedVendorMilestones.filter((milestone) => milestone.status === 'complete').length,
    [selectedVendorMilestones],
  );
  const selectedVendorMilestoneLabels = useMemo(
    () => selectedVendorMilestones.map((milestone) => milestone.label),
    [selectedVendorMilestones],
  );
  const selectedVendorCompletedMilestoneLabels = useMemo(
    () => selectedVendorMilestones
      .filter((milestone) => milestone.status === 'complete')
      .map((milestone) => milestone.label),
    [selectedVendorMilestones],
  );
  const { celebrating: selectedVendorMilestoneCelebrating } = useMilestoneCelebration({
    entityKey: selectedVendor?.id,
    completedCount: selectedVendorCompletedMilestones,
    milestoneLabels: selectedVendorMilestoneLabels,
    completedMilestoneLabels: selectedVendorCompletedMilestoneLabels,
    onReached: ({ milestoneLabel }) => {
      toast({
        title: 'Vendor milestone reached',
        description: `${milestoneLabel} is complete. Zania has updated the next action for this vendor.`,
      });
    },
  });

  const selectedVendorPaymentSummary = useMemo(() => {
    if (!selectedVendor) {
      return {
        invoiceTotal: 0,
        totalPaid: 0,
        balance: 0,
      };
    }

    const invoiceTotal = selectedVendor.price ?? 0;
    const totalPaid = totalRecordedVendorPayments(vendorPaymentsByVendorId[selectedVendor.id] ?? []);
    const balance = Math.max(invoiceTotal - totalPaid, 0);

    return {
      invoiceTotal,
      totalPaid,
      balance,
    };
  }, [selectedVendor, vendorPaymentsByVendorId]);
  const selectedVendorLearningProfile = useMemo(() => {
    if (!selectedVendor?.vendor_listing_id) return null;
    return vendorLearningProfiles[selectedVendor.vendor_listing_id] ?? null;
  }, [selectedVendor, vendorLearningProfiles]);
  const selectedVendorActiveBenchmark = useMemo(() => {
    if (!selectedVendor) return null;
    const categoryBenchmark = categoryBenchmarks[benchmarkKey(selectedVendor.category)];
    const listingBenchmark = selectedVendor.vendor_listing_id
      ? listingBenchmarks[selectedVendor.vendor_listing_id]
      : null;
    return listingBenchmark?.benchmark_visible ? listingBenchmark : categoryBenchmark;
  }, [categoryBenchmarks, listingBenchmarks, selectedVendor]);
  const selectedVendorWorkspaceUpdates = useMemo(() => {
    if (!selectedVendorId) return [];
    return vendorWorkspaceUpdates[selectedVendorId] ?? [];
  }, [selectedVendorId, vendorWorkspaceUpdates]);
  const selectedVendorTaskSuggestions = useMemo(() => {
    if (!selectedVendorId) return [];
    return vendorTaskSuggestions[selectedVendorId] ?? [];
  }, [selectedVendorId, vendorTaskSuggestions]);
  const vendorsAssistantFeature = useMemo(
    () => getVendorsAssistantFeature(profile?.role, profile?.planner_type),
    [profile?.planner_type, profile?.role],
  );

  const finalVendorPaymentsDueSoon = useMemo(() => {
    const today = new Date();
    return finalVendorEntries.filter((vendor) => {
      if (!vendor.payment_due_date || vendor.payment_status === 'paid_full') return false;
      const dueDate = new Date(vendor.payment_due_date);
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
      return diffDays >= 0 && diffDays <= 14;
    });
  }, [finalVendorEntries]);

  const vendorsPrompts = useMemo(() => {
    const prompts: string[] = [];

    if (categoriesNeedingFinalChoice[0]) {
      prompts.push(`Help me close the ${categoriesNeedingFinalChoice[0].category} vendor decision next.`);
    }

    if (finalVendorPaymentsDueSoon[0]) {
      prompts.push('Review the upcoming vendor payment deadlines and tell me what needs action first.');
    }

    if (vendorTaskSummary.openTasks > 0) {
      prompts.push('Summarize the vendor follow-ups still open and tell me what to chase first.');
    }

    if (vendors.length > 0) {
      prompts.push('Give me a quick vendor health check for this wedding and tell me where the biggest gap is.');
    } else {
      prompts.push('Help me decide which vendor categories I should shortlist first.');
    }

    return prompts.slice(0, 3);
  }, [categoriesNeedingFinalChoice, finalVendorPaymentsDueSoon, vendorTaskSummary.openTasks, vendors.length]);

  const vendorsConciergeContext = useMemo(() => buildConciergeContext({
    page: selectedVendor ? `Vendor detail: ${selectedVendor.name}` : 'Vendors',
    role: profile?.role,
    primaryGoal: 'Help the user close vendor decisions, chase follow-ups, and understand payment or claim gaps.',
    nextBestAction: categoriesNeedingFinalChoice[0]
      ? `Close the ${categoriesNeedingFinalChoice[0].category} vendor decision`
      : finalVendorPaymentsDueSoon[0]
        ? `Review payment for ${finalVendorPaymentsDueSoon[0].name}`
        : vendorTaskSummary.openTasks > 0
          ? 'Review open vendor follow-ups'
          : vendors.length === 0
            ? 'Add the first vendor'
            : 'Run a vendor health check',
    facts: [
      ['Vendors tracked', vendors.length],
      ['Visible vendors', vendorWorkspaceVendors.length],
      ['Final vendors', finalVendorEntries.length],
      ['Private vendor records', vendors.filter((vendor) => !vendor.vendor_listing_id).length],
      ['Categories needing final choice', categoriesNeedingFinalChoice.length],
      ['Open vendor tasks', vendorTaskSummary.openTasks],
      ['Linked vendor tasks', vendorTaskSummary.linkedTasks],
      ['Vendor payments due soon', finalVendorPaymentsDueSoon.length],
      ['Selected vendor', selectedVendor?.name],
      ['Selected vendor category', selectedVendor?.category],
      ['Selected vendor status', selectedVendor?.selection_status],
    ],
    risks: [
      vendors.length === 0 ? 'No vendors have been added yet.' : null,
      categoriesNeedingFinalChoice[0] ? `${categoriesNeedingFinalChoice[0].category} still needs a final vendor decision.` : null,
      finalVendorPaymentsDueSoon.length > 0 ? `${finalVendorPaymentsDueSoon.length} final vendor payment(s) are due soon.` : null,
      vendorTaskSummary.openTasks > 0 ? `${vendorTaskSummary.openTasks} vendor follow-up task(s) are open.` : null,
    ].filter(Boolean) as string[],
  }), [
    categoriesNeedingFinalChoice,
    finalVendorEntries.length,
    finalVendorPaymentsDueSoon,
    profile?.role,
    selectedVendor,
    vendorTaskSummary.linkedTasks,
    vendorTaskSummary.openTasks,
    vendorWorkspaceVendors.length,
    vendors,
  ]);

  const vendorsAssistant = useInlineAssistant({
    feature: vendorsAssistantFeature,
    page: 'vendors',
    surface: 'vendor_decision_card',
    contextSource: selectedVendor ? 'selected_vendor_detail' : 'vendor_workspace_summary',
    conciergeContext: vendorsConciergeContext,
  });
  const [vendorsNudgeDismissed, setVendorsNudgeDismissed] = useState(false);

  const vendorsNudge = useMemo(() => {
    if (categoriesNeedingFinalChoice[0]) {
      return {
        title: `${categoriesNeedingFinalChoice.length} vendor categor${categoriesNeedingFinalChoice.length === 1 ? 'y still needs a final decision' : 'ies still need final decisions'}`,
        body: 'Use the assistant to figure out which category to close next.',
        prompt: `Help me close the ${categoriesNeedingFinalChoice[0].category} vendor decision next.`,
      };
    }

    if (finalVendorPaymentsDueSoon[0]) {
      return {
        title: `${finalVendorPaymentsDueSoon.length} final vendor payment${finalVendorPaymentsDueSoon.length === 1 ? '' : 's'} due soon`,
        body: 'A quick review now can help you avoid missing a vendor payment deadline.',
        prompt: 'Review the upcoming vendor payment deadlines and tell me what needs action first.',
      };
    }

    if (vendorTaskSummary.openTasks > 0) {
      return {
        title: 'Vendor follow-ups are still open',
        body: 'Use the assistant to decide which vendor conversation or task to chase first.',
        prompt: 'Summarize the vendor follow-ups still open and tell me what to chase first.',
      };
    }

    if (vendors.length === 0) {
      return {
        title: 'No vendors shortlisted yet',
        body: 'Get a quick recommendation on where to start so the shortlist builds with less guesswork.',
        prompt: 'Help me decide which vendor categories I should shortlist first.',
      };
    }

    return null;
  }, [categoriesNeedingFinalChoice, finalVendorPaymentsDueSoon, vendorTaskSummary.openTasks, vendors.length]);

  const vendorPrimaryAction = useMemo(() => {
    if (vendors.length === 0) {
      return {
        title: 'Add the vendors you already have',
        body: 'Start with private vendor records for the people you are already talking to, then link or invite them later when you want to. These records stay private to this wedding workspace by default.',
        actionLabel: 'Add first vendor record',
        actionType: 'open_add_vendor' as const,
      };
    }

    if (categoriesNeedingFinalChoice[0]) {
      return {
        title: `Close the ${categoriesNeedingFinalChoice[0].category} decision next`,
        body: `${categoriesNeedingFinalChoice.length} vendor categor${categoriesNeedingFinalChoice.length === 1 ? 'y still needs a final pick' : 'ies still need final picks'}.`,
        actionLabel: 'Review with AI',
        actionType: 'assistant_prompt' as const,
        prompt: `Help me close the ${categoriesNeedingFinalChoice[0].category} vendor decision next.`,
      };
    }

    if (finalVendorPaymentsDueSoon[0]) {
      return {
        title: 'Stay ahead of vendor payment deadlines',
        body: `${finalVendorPaymentsDueSoon.length} final vendor payment${finalVendorPaymentsDueSoon.length === 1 ? '' : 's'} falls due in the next two weeks.`,
        actionLabel: 'Review with AI',
        actionType: 'assistant_prompt' as const,
        prompt: 'Review the upcoming vendor payment deadlines and tell me what needs action first.',
      };
    }

    if (vendorTaskSummary.openTasks > 0) {
      return {
        title: nextVendorFollowUpTask?.title ?? 'Review pending vendor tasks',
        body: nextVendorFollowUpTask
          ? `${vendorTaskSummary.openTasks} vendor task${vendorTaskSummary.openTasks === 1 ? '' : 's'} remaining.`
          : `${vendorTaskSummary.openTasks} vendor task${vendorTaskSummary.openTasks === 1 ? '' : 's'} remaining.`,
        actionLabel: nextVendorFollowUpTask ? 'Open task' : null,
        actionType: nextVendorFollowUpTask ? 'task_link' as const : 'none' as const,
        taskId: nextVendorFollowUpTask?.id ?? null,
      };
    }

    return {
      title: 'Your vendor lineup is holding steady',
      body: 'Use this workspace to keep final choices, payments, and vendor notes tidy as the wedding gets closer.',
      actionLabel: null,
      actionType: 'none' as const,
    };
  }, [categoriesNeedingFinalChoice, finalVendorPaymentsDueSoon, nextVendorFollowUpTask, vendorTaskSummary.openTasks, vendors.length]);

  useEffect(() => {
    if (selectedVendorId && !selectedVendor) {
      setSelectedVendorId(null);
      setSelectedVendorTab('details');
    }
  }, [selectedVendorId, selectedVendor]);

  useEffect(() => {
    const requestedVendorId = searchParams.get('vendor');
    if (!requestedVendorId || !vendors.some((vendor) => vendor.id === requestedVendorId)) return;
    const requestedTab = searchParams.get('tab');
    const requestedFocus = searchParams.get('focus');
    const focusedSectionId = requestedFocus === 'payment-plan'
      ? `vendor-payment-plan-${requestedVendorId}`
      : `vendor-${requestedVendorId}`;

    setSelectedVendorId(requestedVendorId);
    if (requestedTab === 'payments') setSelectedVendorTab('payments');

    let scrollTimer: number | undefined;
    let attempts = 0;
    const focusRequestedSection = () => {
      const target = document.getElementById(focusedSectionId);
      if (!target && attempts < 12) {
        attempts += 1;
        scrollTimer = window.setTimeout(focusRequestedSection, 80);
        return;
      }
      if (!target) return;

      setHighlightedVendorSection(focusedSectionId);
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    };
    scrollTimer = window.setTimeout(focusRequestedSection, 120);
    const clearTimer = window.setTimeout(() => {
      setHighlightedVendorSection((current) => current === focusedSectionId ? null : current);
    }, 3_200);

    return () => {
      if (scrollTimer) window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [searchParams, vendors]);

  useEffect(() => {
    if (!selectedVendor || selectedVendor.vendor_listing_id) return;

    let cancelled = false;
    setWorkspaceInviteLoadingVendorId(selectedVendor.id);
    setWorkspaceInviteError(null);

    void listWorkspaceVendorInvitesForVendor(selectedVendor.id)
      .then((invites) => {
        if (cancelled) return;
        setWorkspaceVendorInvites((current) => ({ ...current, [selectedVendor.id]: invites }));
      })
      .catch((error: any) => {
        if (cancelled) return;
        setWorkspaceInviteError(error?.message || 'Could not load vendor invites right now.');
      })
      .finally(() => {
        if (!cancelled) setWorkspaceInviteLoadingVendorId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVendor]);

  useEffect(() => {
    if (!selectedVendor || selectedVendor.vendor_listing_id) return;

    setWorkspaceInviteForm({
      email: selectedVendorActiveInvite?.invite_contact_email ?? selectedVendor.email ?? '',
      phone: selectedVendorActiveInvite?.invite_contact_phone ?? selectedVendor.phone ?? '',
      message: selectedVendorActiveInvite?.invite_message ?? '',
      expiresAt: selectedVendorActiveInvite?.invite_expires_at?.slice(0, 10) ?? '',
    });
    setWorkspaceInviteError(null);
  }, [selectedVendor, selectedVendorActiveInvite]);

  useEffect(() => {
    if (showSharedVendorWorkspace || !selectedVendor) return;

    let cancelled = false;
    setVendorWorkspaceUpdatesLoadingId(selectedVendor.id);

    setVendorTaskSuggestionsLoadingId(selectedVendor.id);
    void Promise.all([
      listVendorWorkspaceUpdates(selectedVendor.id),
      listVendorTaskSuggestions(selectedVendor.id),
    ])
      .then(([updates, suggestions]) => {
        if (cancelled) return;
        setVendorWorkspaceUpdates((current) => ({
          ...current,
          [selectedVendor.id]: updates.filter((update) => !update.is_archived),
        }));
        setVendorTaskSuggestions((current) => ({
          ...current,
          [selectedVendor.id]: suggestions,
        }));
      })
      .catch((error: any) => {
        if (cancelled) return;
        toast({
          title: 'Could not load vendor updates',
          description: error?.message || 'Please try again.',
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!cancelled) {
          setVendorWorkspaceUpdatesLoadingId((current) => (current === selectedVendor.id ? null : current));
          setVendorTaskSuggestionsLoadingId((current) => (current === selectedVendor.id ? null : current));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVendor, showSharedVendorWorkspace, toast]);

  useEffect(() => {
    if (!selectedVendor?.vendor_listing_id) return;

    const listingId = selectedVendor.vendor_listing_id;
    if (Object.prototype.hasOwnProperty.call(vendorLearningProfiles, listingId)) return;

    let cancelled = false;
    setVendorLearningLoadingListingId(listingId);

    void getVendorLearningProfile(listingId)
      .then((profile) => {
        if (cancelled) return;
        setVendorLearningProfiles((prev) => ({ ...prev, [listingId]: profile }));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load vendor learning profile:', error);
        setVendorLearningProfiles((prev) => ({ ...prev, [listingId]: null }));
      })
      .finally(() => {
        if (cancelled) return;
        setVendorLearningLoadingListingId((current) => (current === listingId ? null : current));
      });

    return () => {
      cancelled = true;
    };
  }, [selectedVendor, vendorLearningProfiles]);

  useEffect(() => {
    if (!recordVendorPaymentOpen || !selectedVendor) return;

    setVendorPaymentForm({
      payeeName: selectedVendor.name,
      amount: '',
      paymentDate: new Date().toISOString().slice(0, 10),
      reference: '',
      notes: '',
    });
  }, [recordVendorPaymentOpen, selectedVendor]);

  const archiveSelectedVendorWorkspaceUpdate = async (updateId: string) => {
    if (!selectedVendorId) return;

    setArchivingVendorWorkspaceUpdateId(updateId);
    try {
      await archiveVendorWorkspaceUpdate(updateId, true);
      setVendorWorkspaceUpdates((current) => ({
        ...current,
        [selectedVendorId]: (current[selectedVendorId] ?? []).filter((update) => update.id !== updateId),
      }));
      toast({
        title: 'Vendor update archived',
        description: 'This vendor update is now hidden from the active workspace feed.',
      });
    } catch (error: any) {
      toast({
        title: 'Could not archive vendor update',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setArchivingVendorWorkspaceUpdateId(null);
    }
  };

  const resolveSelectedVendorTaskSuggestion = async (suggestion: VendorTaskSuggestion, action: 'accept' | 'dismiss') => {
    if (!selectedVendorId) return;

    setResolvingVendorTaskSuggestionId(suggestion.id);
    try {
      const resolved = action === 'accept'
        ? await acceptVendorTaskSuggestion(suggestion.id)
        : await dismissVendorTaskSuggestion(suggestion.id);

      setVendorTaskSuggestions((current) => ({
        ...current,
        [selectedVendorId]: (current[selectedVendorId] ?? []).map((item) => (
          item.id === resolved.id ? resolved : item
        )),
      }));

      if (action === 'accept') {
        setAcceptedVendorTaskSuggestionId(suggestion.id);
        await refreshVendorsWorkspace();
        window.setTimeout(() => setAcceptedVendorTaskSuggestionId((current) => current === suggestion.id ? null : current), 1600);
        toast({
          title: 'Suggestion added to the plan',
          description: 'The vendor suggestion is now a real vendor-linked task in your shared wedding workspace.',
        });
      } else {
        toast({
          title: 'Suggestion dismissed',
          description: 'It remains in the relationship history but was not added to the wedding plan.',
        });
      }
    } catch (error: any) {
      toast({
        title: `Could not ${action} suggestion`,
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResolvingVendorTaskSuggestionId(null);
    }
  };

  const vendorUpdateTone = (type: string | null) => {
    switch (type) {
      case 'waiting_on_couple':
      case 'need_approval':
        return 'secondary' as const;
      case 'delivered':
        return 'default' as const;
      default:
        return 'outline' as const;
    }
  };

  const submitVendorPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedVendor || !dataOrFilter) return;

    const amount = Number(vendorPaymentForm.amount);
    const nextErrors: { payeeName?: string; amount?: string } = {};
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.amount = 'Enter a KES amount greater than zero.';

    const payeeName = vendorPaymentForm.payeeName.trim() || selectedVendor.name;
    if (!payeeName) nextErrors.payeeName = 'Add the payee or vendor name for this payment.';
    setVendorPaymentFormErrors(nextErrors);
    setVendorPaymentSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setRecordingVendorPayment(true);
    try {
      const vendorBudgetScope = getVendorCategoryScope(selectedVendor.category);
      const { data: categoryRows, error: categoryLoadError } = await supabase
        .from('budget_categories')
        .select('*')
        .or(dataOrFilter)
        .eq('budget_scope', vendorBudgetScope);

      if (categoryLoadError) throw categoryLoadError;

      let selectedCategory = ((categoryRows ?? []) as any[]).find(
        (category) => vendorCategoriesMatch(category.name, selectedVendor.category),
      );

      if (!selectedCategory) {
        if (plannerNeedsApproval) {
          throw new Error('Ask the couple to approve or create the matching budget category first, then record the payment.');
        }
        const insert: Record<string, unknown> = {
          user_id: user.id,
          name: selectedVendor.category,
          allocated: selectedVendor.price ?? 0,
          spent: 0,
          budget_scope: vendorBudgetScope,
          visibility: vendorBudgetScope === 'personal' ? 'private' : 'public',
        };

        if (isPlanner && selectedClient) {
          insert.client_id = selectedClient.id;
        }

        const { data: insertedCategory, error: insertCategoryError } = await supabase
          .from('budget_categories')
          .insert(insert)
          .select('*')
          .single();

        if (insertCategoryError) throw insertCategoryError;
        selectedCategory = insertedCategory;
      }

      if (plannerNeedsApproval && selectedClient?.linked_user_id) {
        const nextCategorySpent = Number(selectedCategory.spent ?? 0) + amount;
        const recordedTotal = totalRecordedVendorPayments(vendorPaymentsByVendorId[selectedVendor.id] ?? []);
        const nextPaid = recordedTotal + amount;
        const nextStatus = deriveVendorPaymentStatus({
          totalCost: selectedVendor.price,
          depositRequired: selectedVendor.deposit_amount,
          totalPaid: nextPaid,
        });

        await submitPlannerChangeRequest({
          clientId: selectedClient.id,
          coupleUserId: selectedClient.linked_user_id,
          plannerUserId: user.id,
          targetTable: 'budget_payments',
          changeType: 'create',
          currentPayload: {
            category_spent: Number(selectedCategory.spent ?? 0),
          },
          proposedPayload: {
            budget_category_id: selectedCategory.id,
            vendor_id: selectedVendor.id,
            budget_scope: vendorBudgetScope,
            category_name: selectedCategory.name,
            payee_name: payeeName,
            amount,
            payment_date: vendorPaymentForm.paymentDate,
            reference: vendorPaymentForm.reference.trim() || null,
            notes: vendorPaymentForm.notes.trim() || null,
            vendor_amount_paid: nextPaid,
            vendor_payment_status: nextStatus,
            next_category_spent: nextCategorySpent,
          },
        });

        toast({
          title: 'Vendor payment sent for approval',
          description: `${formatCurrency(amount)} for ${selectedVendor.name} is waiting on couple approval.`,
        });

        setRecordVendorPaymentOpen(false);
        return;
      }

      const { error: insertPaymentError } = await supabase.from('budget_payments').insert({
        user_id: user.id,
        client_id: selectedClient?.id ?? null,
        budget_category_id: selectedCategory.id,
        vendor_id: selectedVendor.id,
        budget_scope: vendorBudgetScope,
        category_name: selectedCategory.name,
        payee_name: payeeName,
        amount,
        payment_date: vendorPaymentForm.paymentDate,
        reference: vendorPaymentForm.reference.trim() || null,
        notes: vendorPaymentForm.notes.trim() || null,
      });

      if (insertPaymentError) throw insertPaymentError;

      const nextCategorySpent = Number(selectedCategory.spent ?? 0) + amount;
      const { error: updateCategoryError } = await supabase
        .from('budget_categories')
        .update({ spent: nextCategorySpent })
        .eq('id', selectedCategory.id);

      if (updateCategoryError) throw updateCategoryError;

      const recordedTotal = totalRecordedVendorPayments(vendorPaymentsByVendorId[selectedVendor.id] ?? []);
      const nextPaid = recordedTotal + amount;
      const nextStatus = deriveVendorPaymentStatus({
        totalCost: selectedVendor.price,
        depositRequired: selectedVendor.deposit_amount,
        totalPaid: nextPaid,
      });

      await updateVendorPaymentState({
        vendorId: selectedVendor.id,
        contractAmount: selectedVendor.price ?? null,
        depositAmount: Number(selectedVendor.deposit_amount ?? 0),
        amountPaid: nextPaid,
        paymentStatus: nextStatus,
        paymentDueDate: selectedVendor.payment_due_date ?? null,
      });

      toast({
        title: 'Payment recorded',
        description: `${formatCurrency(amount)} was added for ${selectedVendor.name}.`,
      });

      setRecordVendorPaymentOpen(false);
      await refreshVendorsWorkspace();
    } catch (error: any) {
      setVendorPaymentSubmitError(error.message || 'We could not record this vendor payment right now.');
      toast({
        title: 'Failed to record payment',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRecordingVendorPayment(false);
    }
  };

  const addVendorDialog = (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setMode('custom');
          setDirSearch('');
          setDirResults([]);
          setForm({ name: '', category: 'Wedding Venue', email: '', phone: '', price: '' });
        }
      }}
    >
      <Button type="button" onClick={() => setOpen(true)}>Add vendor</Button>
      <DialogContent className="overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Add vendor</DialogTitle>
          <DialogDescription>Enter their details or find an existing Zania vendor.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 border-b border-border pb-3">
          <Button variant={mode === 'custom' ? 'default' : 'outline'} size="sm" onClick={() => setMode('custom')} className="min-w-0 px-2 sm:px-3">
            Enter details
          </Button>
          <Button variant={mode === 'directory' ? 'default' : 'outline'} size="sm" onClick={() => setMode('directory')} className="min-w-0 px-2 sm:px-3">
            Search Zania
          </Button>
        </div>
        {mode === 'directory' ? (
          <div className="space-y-3">
            <Input placeholder="Search vendors" value={dirSearch} onChange={(e) => setDirSearch(e.target.value)} autoFocus />
            {dirLoading && <p className="text-sm text-muted-foreground">Loading directory…</p>}
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
                <p className="text-sm font-medium text-foreground">No vendors found</p>
                <Button variant="outline" size="sm" onClick={() => setMode('custom')}>Enter details</Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Type at least 2 characters to search.</p>
            )}
          </div>
        ) : (
          <form onSubmit={addVendor} className="space-y-4">
            <FormSubmitError message={vendorSubmitError} />
            <div className="space-y-2">
              <Label>Vendor name</Label>
              <Input value={form.name} onChange={e => {
                setForm(f => ({ ...f, name: e.target.value }));
                setVendorFormErrors((current) => ({ ...current, name: undefined }));
                setVendorSubmitError(null);
              }} placeholder="Business name or contact name" required maxLength={100} />
              <FormFieldError message={vendorFormErrors.name} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={value => setForm(f => ({ ...f, category: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {vendorCategoryCatalog.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name} · {category.scope === 'personal' ? 'Personal' : 'Wedding'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => {
                  setForm(f => ({ ...f, email: e.target.value }));
                  setVendorFormErrors((current) => ({ ...current, email: undefined }));
                  setVendorSubmitError(null);
                }}
                placeholder="vendor@example.com"
                required
                maxLength={120}
              />
              <FormFieldError message={vendorFormErrors.email} />
            </div>
            <details className="rounded-2xl border border-border/70 bg-muted/20 p-3">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground">More details</summary>
              <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={e => {
                    setForm(f => ({ ...f, phone: e.target.value }));
                    setVendorFormErrors((current) => ({ ...current, phone: undefined }));
                    setVendorSubmitError(null);
                  }} placeholder="+254..." />
                  <FormFieldError message={vendorFormErrors.phone} />
                </div>
                <div className="space-y-2">
                  <Label>Quoted price (KES)</Label>
                  <Input type="number" value={form.price} onChange={e => {
                    setForm(f => ({ ...f, price: e.target.value }));
                    setVendorFormErrors((current) => ({ ...current, price: undefined }));
                    setVendorSubmitError(null);
                  }} placeholder="0" />
                  <FormFieldError message={vendorFormErrors.price} />
                </div>
                <div className="rounded-lg border border-border/70 bg-background p-3">
                  <p className="text-sm font-medium text-foreground">Typical price</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {modalBenchmarkLoading ? 'Loading…' : benchmarkSummary(modalBenchmark)}
                  </p>
                </div>
              </div>
            </details>
            <Button type="submit" className="w-full" disabled={addingVendor}>
              {addingVendor ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {addingVendor ? 'Saving…' : 'Add vendor'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );

  const vendorContactDialog = (
    <Dialog
      open={Boolean(contactEditorVendor)}
      onOpenChange={(nextOpen) => {
        if (nextOpen || savingVendorContact) return;
        setContactEditorVendor(null);
        setContactEditorErrors({});
        setContactEditorSubmitError(null);
        setCreateClaimAfterContactSave(false);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {contactEditorVendor?.email || contactEditorVendor?.phone ? 'Edit vendor contact' : 'Add vendor contact'}
          </DialogTitle>
          <DialogDescription>These details stay private to this wedding.</DialogDescription>
        </DialogHeader>
        <form onSubmit={saveVendorContact} className="space-y-4">
          <FormSubmitError message={contactEditorSubmitError} />
          <div className="space-y-2">
            <Label htmlFor="quick-vendor-contact-email">Vendor email</Label>
            <Input
              id="quick-vendor-contact-email"
              type="email"
              value={contactEditorForm.email}
              onChange={(event) => {
                setContactEditorForm((current) => ({ ...current, email: event.target.value }));
                setContactEditorErrors((current) => ({ ...current, email: undefined }));
                setContactEditorSubmitError(null);
              }}
              placeholder="vendor@example.com"
              autoFocus
            />
            <FormFieldError message={contactEditorErrors.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-vendor-contact-phone">Vendor phone</Label>
            <Input
              id="quick-vendor-contact-phone"
              value={contactEditorForm.phone}
              onChange={(event) => {
                setContactEditorForm((current) => ({ ...current, phone: event.target.value }));
                setContactEditorErrors((current) => ({ ...current, phone: undefined }));
                setContactEditorSubmitError(null);
              }}
              placeholder="+254..."
            />
            <FormFieldError message={contactEditorErrors.phone} />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={savingVendorContact}
              onClick={() => {
                setContactEditorVendor(null);
                setCreateClaimAfterContactSave(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={savingVendorContact}>
              {savingVendorContact ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {savingVendorContact
                ? 'Saving...'
                : createClaimAfterContactSave
                  ? 'Save and create link'
                  : 'Save contact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (isPlanner && (plannerClientHydrating || !selectedClient)) return <WorkspacePageSkeleton compact />;
  if (vendorsQuery.isLoading) return <WorkspacePageSkeleton compact />;

  if (showSharedVendorWorkspace) {
    const exportVendorData = () => {
      downloadCsv(
        `zania-vendors-${new Date().toISOString().slice(0, 10)}.csv`,
        vendors.map((vendor) => {
          const vendorTasks = vendorTasksByVendorId[vendor.id] ?? [];
          const vendorPayments = vendorPaymentsByVendorId[vendor.id] ?? [];
          const recordedPaymentTotal = totalRecordedVendorPayments(vendorPayments);
          return {
            vendor_name: vendor.name,
            category: vendor.category,
            phone: vendor.phone ?? '',
            email: vendor.email ?? '',
            selection_status: vendor.selection_status,
            payment_status: vendor.payment_status,
            contract_status: vendor.contract_status,
            quoted_price_kes: vendor.price ?? '',
            amount_paid_kes: recordedPaymentTotal,
            outstanding_kes: vendor.price != null ? Math.max(vendor.price - recordedPaymentTotal, 0) : '',
            payment_due_date: safeDateLabel(vendor.payment_due_date),
            open_tasks: vendorTasks.filter((task) => !task.completed).length,
            completed_tasks: vendorTasks.filter((task) => task.completed).length,
            payment_count: vendorPayments.length,
            notes: notesDrafts[vendor.id] ?? vendor.notes ?? '',
          };
        }),
      );
    };

    const renderVendorRow = (vendor: Vendor) => {
      const vendorTasks = vendorTasksByVendorId[vendor.id] ?? [];
      const openVendorTasks = vendorTasks.filter((task) => !task.completed).length;
      const vendorPayments = vendorPaymentsByVendorId[vendor.id] ?? [];
      const recordedPaymentTotal = totalRecordedVendorPayments(vendorPayments);
      const outstandingBalance = Math.max((vendor.price ?? 0) - recordedPaymentTotal, 0);
      const paymentProgress = vendor.price && vendor.price > 0
        ? Math.min((recordedPaymentTotal / vendor.price) * 100, 100)
        : 0;
      const dueDateLabel = vendor.payment_due_date ? safeDateLabel(vendor.payment_due_date) : null;
      const isActive = selectedVendorId === vendor.id;
      const detailsDraft = vendorDetailsDrafts[vendor.id] ?? {
        name: vendor.name,
        category: vendor.category,
        email: vendor.email ?? '',
        phone: vendor.phone ?? '',
      };
      const vendorActiveInvite = (workspaceVendorInvites[vendor.id] ?? []).find((invite) =>
        ['draft', 'pending', 'sent', 'opened'].includes(invite.invite_status),
      ) ?? null;
      const vendorContract = isActive ? selectedVendorContractQuery.data ?? null : null;
      const vendorContractUrl = vendorContract
        ? coupleVendorContractShareUrl(vendorContract, window.location.origin)
        : null;
      const selectionStatusTextClass = vendor.selection_status === 'final'
        ? 'text-success'
        : vendor.selection_status === 'declined'
          ? 'text-destructive'
          : vendor.selection_status === 'backup'
            ? 'text-warning-foreground'
            : 'text-primary';
      const selectionStatusDotClass = vendor.selection_status === 'final'
        ? 'bg-success'
        : vendor.selection_status === 'declined'
          ? 'bg-destructive'
          : vendor.selection_status === 'backup'
            ? 'bg-warning'
            : 'bg-primary';

      return (
        <motion.div
          key={vendor.id}
          id={`vendor-${vendor.id}`}
          layout={!prefersReducedMotion}
          animate={prefersReducedMotion ? undefined : isActive ? { y: -1 } : { y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: 'easeOut' }}
          className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-xl border text-left transition-[border-color,background-color,box-shadow,opacity] duration-200 ${isActive ? 'z-10 border-primary/55 bg-primary/[0.025] shadow-[0_16px_38px_-28px_hsl(var(--foreground)/0.6)] ring-1 ring-primary/10' : 'border-border/80 bg-card/90 hover:border-primary/25 hover:bg-card'}`}
        >
          <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 bg-primary transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
          <button
            type="button"
            onClick={() => setSelectedVendorId(isActive ? null : vendor.id)}
            aria-expanded={isActive}
            className={`w-full px-5 py-5 text-left transition-colors duration-200 sm:px-7 ${isActive ? 'bg-primary/[0.07]' : 'hover:bg-muted/30'}`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-lg font-semibold text-foreground">{vendor.name}</p>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${selectionStatusTextClass}`}>
                    <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${selectionStatusDotClass}`} />
                    {vendorSelectionLabel(vendor.selection_status)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatCurrency(recordedPaymentTotal)} paid · {formatCurrency(outstandingBalance)} balance
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{vendor.category}</span>
                  {openVendorTasks > 0 ? <span>· {openVendorTasks} follow-up{openVendorTasks === 1 ? '' : 's'}</span> : null}
                  {dueDateLabel && vendor.payment_status !== 'paid_full' ? <span>· Next payment {dueDateLabel}</span> : null}
                </div>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-lg font-semibold text-foreground">{formatCurrency(vendor.price)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{vendorPaymentStatusLabel(vendor.payment_status)}</p>
                <p className="mt-1 text-sm font-medium text-primary">{isActive ? 'Hide details' : 'View details'}</p>
              </div>
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-accent/60">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${paymentProgress}%` }} />
            </div>
          </button>

          <AnimatedCardDetails open={isActive}>
            <div className="min-w-0 space-y-5 border-t border-border bg-background/60 px-4 pb-6 pt-5 sm:px-7">
              <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-background/70 text-center">
                <div className="p-3"><p className="text-xs text-muted-foreground">Invoice</p><p className="mt-1 font-semibold">{formatCurrency(vendor.price)}</p></div>
                <div className="p-3"><p className="text-xs text-muted-foreground">Paid</p><p className="mt-1 font-semibold">{formatCurrency(recordedPaymentTotal)}</p></div>
                <div className="p-3"><p className="text-xs text-muted-foreground">Balance</p><p className="mt-1 font-semibold">{formatCurrency(outstandingBalance)}</p></div>
              </div>

              <details className="rounded-xl border border-border/80 bg-card/70 p-4">
                <summary className="cursor-pointer list-none font-semibold text-foreground">Contact details</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor={`vendor-name-${vendor.id}`}>Vendor name</Label>
                    <Input
                      id={`vendor-name-${vendor.id}`}
                      value={detailsDraft.name}
                      onChange={(event) => setVendorDetailsDrafts((current) => ({
                        ...current,
                        [vendor.id]: { ...detailsDraft, name: event.target.value },
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={detailsDraft.category}
                      onValueChange={(value) => setVendorDetailsDrafts((current) => ({
                        ...current,
                        [vendor.id]: { ...detailsDraft, category: value },
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {getVendorCategoryOptions(detailsDraft.category).map((category) => (
                          <SelectItem key={category.name} value={category.name}>
                            {category.name} · {category.scope === 'personal' ? 'Personal' : 'Wedding'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`vendor-email-${vendor.id}`}>Email</Label>
                    <Input
                      id={`vendor-email-${vendor.id}`}
                      type="email"
                      value={detailsDraft.email}
                      onChange={(event) => setVendorDetailsDrafts((current) => ({
                        ...current,
                        [vendor.id]: { ...detailsDraft, email: event.target.value },
                      }))}
                      placeholder="vendor@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`vendor-phone-${vendor.id}`}>Phone</Label>
                    <Input
                      id={`vendor-phone-${vendor.id}`}
                      value={detailsDraft.phone}
                      onChange={(event) => setVendorDetailsDrafts((current) => ({
                        ...current,
                        [vendor.id]: { ...detailsDraft, phone: event.target.value },
                      }))}
                      placeholder="+254..."
                    />
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button type="button" variant="outline" onClick={() => updateVendorDetails(vendor)} disabled={savingVendorDetailsId === vendor.id}>
                    {savingVendorDetailsId === vendor.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save vendor details
                  </Button>
                </div>
              </details>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
                <div className="rounded-xl border border-border/80 bg-card/70 p-4 sm:p-5">
                  <p className="font-semibold text-foreground">Confirmation and contract</p>
                  <p className="mt-1 text-sm text-muted-foreground">Choose this vendor and review any shared contract.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Vendor decision</Label>
                      <Select
                        value={(vendor.selection_status || 'shortlisted') as VendorSelectionStatus}
                        onValueChange={(value) => void updateSelection(vendor, value as VendorSelectionStatus)}
                        disabled={savingSelectionId === vendor.id}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {selectionStatuses.map((status) => <SelectItem key={status} value={status}>{vendorSelectionLabel(status)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="min-w-0 rounded-lg border border-border/70 bg-background/80 p-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <FileSignature className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">Vendor contract</p>
                            {vendorContract ? (
                              <Badge variant="outline" className="text-[10px]">
                                {coupleVendorContractStatusLabel(vendorContract)}
                              </Badge>
                            ) : null}
                          </div>

                          {selectedVendorContractQuery.isLoading ? (
                            <p className="mt-1 text-xs text-muted-foreground">Checking for a shared contract...</p>
                          ) : selectedVendorContractQuery.isError ? (
                            <p className="mt-1 text-xs text-destructive">The contract could not be loaded. Please try again.</p>
                          ) : vendorContract ? (
                            <>
                              <p className="mt-1 truncate text-sm font-medium text-foreground">{vendorContract.title}</p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {coupleVendorContractMessage(vendorContract)}
                              </p>
                              {vendorContractUrl ? (
                                <Button asChild type="button" variant="link" className="mt-2 h-auto p-0 text-xs">
                                  <a href={vendorContractUrl} target="_blank" rel="noreferrer">
                                    Open contract
                                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                  </a>
                                </Button>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <p className="mt-1 text-sm font-medium text-foreground">No contract shared yet</p>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {vendor.vendor_listing_id
                                  ? 'This vendor has not sent a contract through Zania yet.'
                                  : 'Connect this vendor to their professional account so they can create and share the contract here.'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  id={`vendor-payment-plan-${vendor.id}`}
                  tabIndex={-1}
                  className={`scroll-mt-24 rounded-xl border border-border/80 bg-card/70 p-4 outline-none transition-[background-color,box-shadow] duration-300 sm:p-5 ${
                    highlightedVendorSection === `vendor-payment-plan-${vendor.id}`
                      ? 'bg-primary/[0.07] shadow-[0_0_0_3px_hsl(var(--primary)/0.28)]'
                      : ''
                  }`}
                >
                  <p className="font-semibold text-foreground">Cost and payment plan</p>
                  <p className="mt-1 text-sm text-muted-foreground">Set the agreed cost and next payment date.</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`vendor-price-${vendor.id}`}>Total vendor cost</Label>
                      <Input id={`vendor-price-${vendor.id}`} type="number" min="0" value={priceDrafts[vendor.id] ?? ''} onChange={(event) => setPriceDrafts((current) => ({ ...current, [vendor.id]: event.target.value }))} />
                      <p className="text-xs text-muted-foreground">The full agreed price, used to calculate the outstanding balance.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`vendor-deposit-${vendor.id}`}>Booking deposit</Label>
                      <Input id={`vendor-deposit-${vendor.id}`} type="number" min="0" value={paymentDrafts[vendor.id]?.depositAmount ?? '0'} onChange={(event) => setPaymentDrafts((current) => ({
                        ...current,
                        [vendor.id]: { ...(current[vendor.id] ?? { depositAmount: '0', paymentStatus: 'unpaid', paymentDueDate: '' }), depositAmount: event.target.value },
                      }))} />
                      <p className="text-xs text-muted-foreground">This is not counted as paid until you record it.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Payments recorded</Label>
                      <div className="min-h-10 rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                        <p className="font-semibold text-foreground">{formatCurrency(recordedPaymentTotal)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Calculated from {vendorPayments.length} payment {vendorPayments.length === 1 ? 'record' : 'records'}.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Payment stage</Label>
                      <div className="min-h-10 rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                        <p className="font-semibold text-foreground">
                          {vendorPaymentStatusLabel(deriveVendorPaymentStatus({
                            totalCost: priceDrafts[vendor.id],
                            depositRequired: paymentDrafts[vendor.id]?.depositAmount,
                            totalPaid: recordedPaymentTotal,
                          }))}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Calculated from recorded payments.</p>
                      </div>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`vendor-due-${vendor.id}`}>Next payment date</Label>
                      <Input id={`vendor-due-${vendor.id}`} type="date" value={paymentDrafts[vendor.id]?.paymentDueDate ?? ''} onChange={(event) => setPaymentDrafts((current) => ({
                        ...current,
                        [vendor.id]: { ...(current[vendor.id] ?? { depositAmount: '0', paymentStatus: 'unpaid', paymentDueDate: '' }), paymentDueDate: event.target.value },
                      }))} />
                      <PaymentReminderStatus
                        dueDate={paymentDrafts[vendor.id]?.paymentDueDate}
                        vendorName={vendor.name}
                        saved={(paymentDrafts[vendor.id]?.paymentDueDate || null) === vendor.payment_due_date}
                        inputId={`vendor-due-${vendor.id}`}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Payment history</Label>
                        <span className="text-xs text-muted-foreground">
                          {vendorPayments.length} recorded
                        </span>
                      </div>
                      <div className="divide-y divide-border overflow-hidden rounded-md border border-border/70 bg-background/80">
                        {vendorPayments.length > 0 ? (
                          vendorPayments
                            .slice()
                            .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
                            .map((payment) => (
                              <div key={payment.id} className="flex items-start justify-between gap-4 px-3 py-2.5">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-foreground">{formatCurrency(payment.amount)}</p>
                                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {payment.reference || 'No payment reference'}
                                  </p>
                                </div>
                                <time className="shrink-0 text-xs text-muted-foreground" dateTime={payment.payment_date}>
                                  {new Date(`${payment.payment_date}T00:00:00`).toLocaleDateString('en-KE', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </time>
                              </div>
                            ))
                        ) : (
                          <p className="px-3 py-4 text-sm text-muted-foreground">
                            No payments recorded yet. Record a payment when money changes hands.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button type="button" onClick={() => updateVendorPayment(vendor)} disabled={savingPaymentId === vendor.id}>
                      {savingPaymentId === vendor.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save payment plan
                    </Button>
                  </div>
                </div>
              </div>

              <details className="rounded-xl border border-border/80 bg-card/70 p-4 sm:p-5">
                <summary className="cursor-pointer list-none font-semibold text-foreground">More vendor details</summary>
                <div className="mt-4 space-y-5 border-t border-border/70 pt-4">
              <div className="grid min-w-0 gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">Follow-ups</p>
                      <p className="mt-1 text-sm text-muted-foreground">Keep vendor tasks attached here.</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${openVendorTasks > 0 ? 'text-warning-foreground' : 'text-success'}`}>
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${openVendorTasks > 0 ? 'bg-warning' : 'bg-success'}`} />
                      {openVendorTasks} open
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {vendorTasks.filter((task) => !task.completed).slice(0, 4).map((task) => (
                      <div key={task.id} className="rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm font-medium text-foreground">{task.title}</div>
                    ))}
                    {openVendorTasks === 0 ? <p className="text-sm text-muted-foreground">No open follow-ups.</p> : null}
                  </div>
                  <Button type="button" variant="link" className="mt-3 h-auto p-0" onClick={() => {
                    resetVendorTaskForm();
                    setVendorTaskDialogVendor(vendor);
                  }}>
                    Add a follow-up task
                  </Button>
                </div>
                <div className="rounded-xl border border-border/80 bg-card/70 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">Private notes</p>
                      <p className="mt-1 text-sm text-muted-foreground">Keep comparison and booking details together.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => updateVendorNotes(vendor)} disabled={savingNotesId === vendor.id}>
                      {savingNotesId === vendor.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save notes
                    </Button>
                  </div>
                  <Textarea className="mt-4 min-h-28" value={notesDrafts[vendor.id] ?? ''} onChange={(event) => setNotesDrafts((current) => ({ ...current, [vendor.id]: event.target.value }))} placeholder="Why you shortlisted this vendor, contract notes, and anything to remember..." />
                </div>
              </div>

              {!vendor.vendor_listing_id ? (
                <div className="flex flex-col gap-2 border-t border-border/70 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground">Want this vendor to collaborate in Zania?</p>
                  <div className="flex flex-wrap gap-2">
                    {vendorActiveInvite ? (
                      <Button asChild type="button" variant="link" size="sm" className="h-auto p-0">
                        <Link to={`/vendor-claim?token=${encodeURIComponent(vendorActiveInvite.invite_token)}&email=${encodeURIComponent(vendorActiveInvite.invite_contact_email ?? '')}`}>
                          Open vendor claim link
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        disabled={workspaceInviteLoadingVendorId === vendor.id || workspaceInviteSubmittingVendorId === vendor.id || !activeWeddingId}
                        onClick={() => void createQuickVendorClaimLink(vendor)}
                      >
                        {workspaceInviteLoadingVendorId === vendor.id || workspaceInviteSubmittingVendorId === vendor.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {vendor.email || vendor.phone ? 'Create private claim link' : 'Add contact and create link'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
                </div>
              </details>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                {vendor.vendor_listing_id ? (
                  <Button
                    type="button"
                    className="w-full gap-2 sm:w-auto"
                    onClick={() => void sendVendorQuoteRequest(vendor)}
                    disabled={requestingQuoteVendorId === vendor.id}
                  >
                    {requestingQuoteVendorId === vendor.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Receipt className="h-4 w-4" />
                    )}
                    Request quote
                  </Button>
                ) : null}
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setSelectedVendorId(null)}>Close</Button>
                <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Remove vendor" title="Remove vendor" onClick={() => deleteVendor(vendor.id)}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
              {vendorPayments.length > 0 ? <p className="text-xs text-muted-foreground">{vendorPayments.length} payment{vendorPayments.length === 1 ? '' : 's'} recorded</p> : null}
            </div>
          </AnimatedCardDetails>
        </motion.div>
      );
    };

    return (
      <div className="w-full min-w-0 max-w-full space-y-8">
        {vendorContactDialog}
        <Dialog
          open={Boolean(vendorTaskDialogVendor)}
          onOpenChange={(openState) => {
            if (!openState) {
              setVendorTaskDialogVendor(null);
              resetVendorTaskForm();
            }
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">
                Add task for {vendorTaskDialogVendor?.name}
              </DialogTitle>
              <DialogDescription>Choose a task or enter your own.</DialogDescription>
            </DialogHeader>
            {vendorTaskDialogVendor && (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitVendorTask(vendorTaskDialogVendor);
                }}
              >
                <FormSubmitError message={vendorTaskSubmitError} />
                <div className="space-y-2">
                  <Label>Task</Label>
                  <Select
                    value={vendorTaskTemplateKey}
                    onValueChange={(value) => {
                      setVendorTaskTemplateKey(value);
                      if (value === 'none') return;
                      const template = vendorTaskSuggestedOptions.find((option) => option.key === value);
                      if (!template) return;
                      setVendorTaskForm((prev) => ({
                        ...prev,
                        title: template.title,
                        description: template.description,
                        assignedTo: prev.assignedTo || template.recommendedRole || '',
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a suggested task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Custom task</SelectItem>
                      {vendorTaskSuggestedOptions.map((template) => (
                        <SelectItem key={template.key} value={template.key}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedVendorTaskTemplate && (
                    <p className="text-xs text-muted-foreground">
                      {selectedVendorTaskTemplate.description}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Task title</Label>
                  <Input
                    value={vendorTaskForm.title}
                    onChange={(event) => {
                      setVendorTaskForm((prev) => ({ ...prev, title: event.target.value }));
                      setVendorTaskFormErrors((current) => ({ ...current, title: undefined }));
                      setVendorTaskSubmitError(null);
                    }}
                    placeholder={selectedVendorTaskTemplate?.title ?? `Confirm contract with ${vendorTaskDialogVendor.name}`}
                    required
                  />
                  <FormFieldError message={vendorTaskFormErrors.title} />
                </div>
                <details className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <summary className="cursor-pointer list-none text-sm font-medium text-foreground">More details</summary>
                  <div className="mt-4 space-y-4 border-t border-border/70 pt-4">
                    <p className="text-xs text-muted-foreground">
                      {vendorTaskDialogVendor.category}
                      {resolvedVendorTaskDefaults
                        ? ` · ${resolvedVendorTaskDefaults.visibility === 'private' ? 'Private' : 'Shared'} · Priority ${resolvedVendorTaskDefaults.priorityLevel}`
                        : ''}
                    </p>
                    <div className="space-y-2">
                      <Label>Assigned to</Label>
                      <Input
                        value={vendorTaskForm.assignedTo}
                        onChange={(event) => setVendorTaskForm((prev) => ({ ...prev, assignedTo: event.target.value }))}
                        placeholder="Couple, committee lead, planner, MC"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Due date</Label>
                      <Input
                        type="date"
                        value={vendorTaskForm.dueDate}
                        onChange={(event) => setVendorTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        rows={3}
                        value={vendorTaskForm.description}
                        onChange={(event) => setVendorTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                        placeholder="Add useful details"
                      />
                    </div>
                  </div>
                </details>
                <Button type="submit" className="w-full gap-2" disabled={vendorTaskSubmitting}>
                  {vendorTaskSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  Add task
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
        {showSharedVendorWorkspace ? (
          <>
            <header className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-editorial text-3xl font-semibold text-foreground sm:text-4xl">Vendors</h1>
                <p className="mt-2 text-sm text-muted-foreground">Compare options and choose who to book.</p>
              </div>
              {addVendorDialog}
            </header>

            <div className={`grid gap-3 ${!isPlanner ? 'xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)] xl:items-start' : ''}`}>
              {!isPlanner && <CoupleLeadMarketplace weddingId={activeWeddingId} />}

              <Card className="rounded-lg border-primary/25 bg-primary/5 shadow-none">
              {vendorPrimaryAction.actionType === 'task_link' && vendorPrimaryAction.taskId ? (
                <Link
                  to={`/tasks?task=${encodeURIComponent(vendorPrimaryAction.taskId)}`}
                  className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <CardContent className="flex min-h-20 items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Next vendor task</p>
                      <h2 className="mt-1 text-base font-semibold text-foreground group-hover:text-primary">{vendorPrimaryAction.title}</h2>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-primary">Open task</span>
                  </CardContent>
                </Link>
              ) : (
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Next vendor action</p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">{vendorPrimaryAction.title}</h2>
                </CardContent>
              )}
            </Card>

            <Card className="rounded-lg border-border shadow-none">
              <CardContent className="p-2.5 sm:p-3">
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground" aria-label="Vendor progress">
                  <span><strong className="font-semibold text-foreground">{vendorConfirmationSummary.total}</strong> categories</span>
                  <span><strong className="font-semibold text-foreground">{vendorConfirmationSummary.confirmed}</strong> confirmed</span>
                  <span><strong className="font-semibold text-foreground">{vendorConfirmationSummary.pending}</strong> pending</span>
                </div>
                <div className="grid gap-2 md:grid-cols-[minmax(16rem,1fr)_auto_auto] md:items-center">
                <div className="min-w-0">
                  <Input
                    value={vendorWorkspaceQuery}
                    onChange={(event) => setVendorWorkspaceQuery(event.target.value)}
                    placeholder="Search vendors"
                  />
                </div>

                <SlidingSegmentedControl
                  label="Vendor view"
                  layoutId="vendor-list-view-selection"
                  value={vendorListView}
                  options={[{ value: 'by_category', label: 'Categories' }, { value: 'by_name', label: 'Name' }]}
                  onChange={setVendorListView}
                  minWidthClassName="w-full min-w-0 md:min-w-[15rem]"
                />

                <UpgradePromptDialog
                  open={exportUpgradeOpen}
                  onOpenChange={setExportUpgradeOpen}
                  decision={exportDecision.allowed ? null : exportDecision}
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full md:w-auto"
                  variant="outline"
                  onClick={() => {
                    if (!exportDecision.allowed) {
                      setExportUpgradeOpen(true);
                      return;
                    }
                    exportVendorData();
                  }}
                >
                  Export vendors
                </Button>
                </div>
              </CardContent>
            </Card>

            {vendorWorkspaceVendors.length === 0 && (vendors.length === 0 || vendorListView === 'by_name' || Boolean(vendorWorkspaceQuery.trim())) ? (
              <Card className="semantic-surface-info border-dashed shadow-card">
                <CardContent className="flex flex-col items-start gap-4 p-6 sm:p-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold text-foreground">
                      {vendors.length === 0 ? 'No vendors yet' : 'No vendors found'}
                    </h2>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {vendors.length === 0
                        ? 'Add someone you are considering or have already booked.'
                        : 'Try another search.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {vendors.length > 0 ? (
                      <Button type="button" variant="outline" onClick={() => setVendorWorkspaceQuery('')}>
                        Clear search
                      </Button>
                    ) : (
                      <Button type="button" onClick={() => setOpen(true)}>Add vendor</Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : vendorListView === 'by_name' ? (
              <div className="space-y-4">
                {filteredVendorsByName.map(renderVendorRow)}
              </div>
            ) : (
              <div className="space-y-6">
                {visibleVendorCategoryEntries.map(([category, group]) => {
                  const chosenVendor = group.find(isChosenVendor) ?? null;
                  const featuredVendor = chosenVendor
                    ?? group.find((vendor) => vendor.selection_status !== 'declined')
                    ?? group[0]
                    ?? null;
                  const openTasks = new Map<string, VendorTaskItem>();
                  group.forEach((vendor) => {
                    (vendorTasksByVendorId[vendor.id] ?? [])
                      .filter((task) => !task.completed)
                      .forEach((task) => openTasks.set(task.id, task));
                  });
                  const openTaskCount = openTasks.size;
                  const outstandingBalance = group.reduce(
                    (total, vendor) => total + Math.max(
                      (vendor.price ?? 0) - totalRecordedVendorPayments(vendorPaymentsByVendorId[vendor.id] ?? []),
                      0,
                    ),
                    0,
                  );
                  const isExpanded = expandedVendorCategories[category] ?? group.length > 0;
                  const statusLabel = chosenVendor
                    ? 'Confirmed'
                    : group.length > 0
                      ? 'Needs confirmation'
                      : 'Pending';
                  const statusTextClass = chosenVendor
                    ? 'text-success'
                    : group.length > 0
                      ? 'text-warning-foreground'
                      : 'text-muted-foreground';
                  const statusDotClass = chosenVendor
                    ? 'bg-success'
                    : group.length > 0
                      ? 'bg-warning'
                      : 'bg-primary/35';
                  const categoryScope = getVendorCategoryScope(category) === 'personal' ? 'Personal' : 'Wedding';

                  return (
                    <section key={category} className="w-full min-w-0 max-w-full">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={`${category} vendor category. ${statusLabel}. ${isExpanded ? 'Collapse' : 'Expand'}`}
                        onClick={() => {
                          setExpandedVendorCategories((current) => ({
                            ...current,
                            [category]: !(current[category] ?? group.length > 0),
                          }));
                        }}
                        className={`group relative w-full overflow-hidden rounded-2xl border px-5 py-5 text-left shadow-[0_12px_32px_-30px_hsl(var(--foreground)/0.5)] transition-[border-color,background-color,box-shadow] hover:shadow-[0_18px_38px_-28px_hsl(var(--foreground)/0.5)] sm:px-7 ${
                          chosenVendor
                            ? 'semantic-surface-success hover:border-success/40'
                            : group.length > 0
                              ? 'semantic-surface-warning hover:border-warning/40'
                              : 'border-border/80 bg-muted/35 hover:border-primary/30 hover:bg-muted/50'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 w-1.5 ${
                            chosenVendor
                              ? 'bg-success'
                              : group.length > 0
                                ? 'bg-warning'
                                : 'bg-primary/30'
                          }`}
                        />
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className={`inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTextClass}`}>
                                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusDotClass}`} />
                                {statusLabel}
                              </span>
                            </div>
                            <h2 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">{category}</h2>
                            {categoryScope === 'Personal' ? <p className="text-xs font-medium text-muted-foreground">Private</p> : null}
                            {featuredVendor ? (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                <span className="font-medium text-foreground">{featuredVendor.name}</span>
                                <span className="text-muted-foreground">
                                  {vendorSelectionLabel(featuredVendor.selection_status)}
                                </span>
                                {group.length > 1 ? (
                                  <span className="text-muted-foreground">+ {group.length - 1} more</span>
                                ) : null}
                              </div>
                            ) : (
                              <p className="text-sm font-medium text-foreground">No vendor added yet</p>
                            )}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                              <span>
                                {openTaskCount} task{openTaskCount === 1 ? '' : 's'} remaining
                              </span>
                              {group.length > 0 ? (
                                <span>{formatCurrency(outstandingBalance)} balance</span>
                              ) : (
                                <span>Add a vendor to start this category</span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="hidden text-xs text-muted-foreground sm:inline">
                              {group.length} vendor{group.length === 1 ? '' : 's'}
                            </span>
                            <ChevronDown
                              aria-hidden="true"
                              className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </div>
                        </div>
                      </button>

                      <AnimatedCardDetails open={isExpanded}>
                        <div className="relative ml-2 min-w-0 max-w-[calc(100%_-_0.5rem)] pl-4 pt-4 sm:ml-7 sm:max-w-[calc(100%_-_1.75rem)] sm:pl-7">
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-primary/45 via-primary/20 to-transparent"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute left-[-3px] top-7 h-[7px] w-[7px] rounded-full bg-primary/55 ring-4 ring-background"
                          />
                          <div className="space-y-4">
                            {group.length > 0 ? group.map(renderVendorRow) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setMode('custom');
                                  setForm({ name: '', category, email: '', phone: '', price: '' });
                                  setOpen(true);
                                }}
                                className="flex w-full items-center justify-between gap-4 rounded-xl border border-dashed border-border/80 bg-card/80 px-5 py-5 text-left shadow-[0_10px_28px_-28px_hsl(var(--foreground)/0.5)] transition-colors hover:border-primary/30 hover:bg-primary/[0.025] sm:px-7"
                              >
                                <div>
                                  <p className="mt-1 font-medium text-foreground">Add your {category.toLowerCase()} vendor</p>
                                </div>
                                <span className="shrink-0 text-sm font-medium text-primary">Add vendor</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </AnimatedCardDetails>
                    </section>
                  );
                })}
                {!vendorWorkspaceQuery.trim() && hiddenEmptyVendorCategoryCount > 0 ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowEmptyVendorCategories((current) => !current)}
                    >
                      {showEmptyVendorCategories
                        ? 'Hide empty categories'
                        : `Show empty categories (${hiddenEmptyVendorCategoryCount})`}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            <details className="hidden rounded-[1.6rem] border border-border/70 bg-card shadow-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
                <div>
                  <p className="text-lg font-semibold text-foreground">AI guidance</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open this when you want help prioritizing vendor decisions, shortlist gaps, or follow-ups.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <span>{categoriesNeedingFinalChoice.length} open decisions</span>
                  <span>{vendorTaskSummary.openTasks} follow-ups</span>
                </div>
              </summary>

              <div className="space-y-4 px-6 pb-6">
                {!vendorsNudgeDismissed && vendorsNudge && assistantPanel && (
                  <Card className="semantic-surface-info shadow-card">
                    <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{vendorsNudge.title}</p>
                        <p className="text-sm text-muted-foreground">{vendorsNudge.body}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="gap-2"
                          onClick={() => assistantPanel.openAssistant(vendorsNudge.prompt)}
                        >
                          Review with AI
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setVendorsNudgeDismissed(true)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!vendorsAssistant.dismissed && (
                  <InlineAssistantCard
                    title="Which vendor decision needs attention?"
                    description="A quick read on vendor decisions and follow-ups."
                    badgeLabel="AI Vendors"
                    prompts={vendorsPrompts}
                    response={vendorsAssistant.response}
                    error={vendorsAssistant.error}
                    loading={vendorsAssistant.loading || vendorsAssistant.usageLoading || vendorsAssistant.accessLoading}
                    decision={vendorsAssistant.decision}
                    canUseAssistant={vendorsAssistant.canUseAssistant}
                    emptyStateTitle="Get a simple vendor priority check before you dive into the list"
                    emptyStateBody="Ask for help closing a category, reviewing follow-ups, or seeing which vendor decision matters most right now."
                    dismissible
                    onDismiss={() => vendorsAssistant.setDismissed(true)}
                    onPromptClick={(prompt) => vendorsAssistant.runPrompt(prompt)}
                  />
                )}
              </div>
            </details>
            </div>
          </>
        ) : (
          <>
            <Card className={`overflow-hidden border-primary/70 bg-gradient-to-br from-primary/[0.075] via-background to-muted/30 shadow-[0_18px_44px_-28px_hsl(var(--foreground)/0.58)] ring-1 ring-primary/15 transition-[border-color,box-shadow] duration-300 ease-zania motion-reduce:transition-none ${
              selectedVendorMilestoneCelebrating
                ? 'border-[#dfbd79] shadow-[0_0_0_5px_rgba(223,189,121,0.14),0_22px_52px_rgba(74,51,30,0.10)]'
                : 'border-border/70'
            }`}>
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setSelectedVendorId(null);
                          setSelectedVendorTab('details');
                        }}
                      >
                        Back to vendors
                      </Button>
                      <div>
                        <Badge variant="outline" className="rounded-full">{selectedVendor.category}</Badge>
                        <h1 className="workspace-h1 mt-3">
                          {selectedVendor.name}
                        </h1>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant={vendorSelectionTone(selectedVendor.selection_status)}>
                            {vendorSelectionLabel(selectedVendor.selection_status)}
                          </Badge>
                          <Badge variant={vendorPaymentStatusTone(selectedVendor.payment_status)}>
                            {vendorPaymentStatusLabel(selectedVendor.payment_status)}
                          </Badge>
                          <Badge variant="outline">{contractStatusLabel(selectedVendor.contract_status)}</Badge>
                          {selectedVendor.phone && <span>{selectedVendor.phone}</span>}
                          {selectedVendor.email && <span>{selectedVendor.email}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 xl:w-[520px] xl:grid-cols-4">
                      <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Quote</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(selectedVendor.price)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Paid</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(selectedVendorPaymentSummary.totalPaid)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Open Tasks</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{selectedVendorTaskCounts.open.length}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/90 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Milestones</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">
                          {selectedVendorCompletedMilestones}/{selectedVendorMilestones.length || 4}
                        </p>
                      </div>
                    </div>
                  </div>

                    <div className="rounded-[1.4rem] border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-semibold text-foreground">Next focus</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {selectedVendorNextMilestone
                          ? `${selectedVendorNextMilestone.label}${selectedVendorNextMilestone.nextOpenTask ? `, starting with "${selectedVendorNextMilestone.nextOpenTask.title}".` : '.'}`
                          : selectedVendorPaymentSummary.balance > 0
                            ? `${formatCurrency(selectedVendorPaymentSummary.balance)} is still outstanding on this vendor.`
                          : 'This vendor looks tidy.'}
                      </p>
                    </div>

                  <div className="flex justify-center overflow-x-auto">
                    <SlidingSegmentedControl
                      label="Vendor details view"
                      layoutId="vendor-detail-tab-selection"
                      value={selectedVendorTab}
                      options={[{ value: 'details', label: 'Details' }, { value: 'tasks', label: 'Tasks' }, { value: 'payments', label: 'Payments' }]}
                      onChange={setSelectedVendorTab}
                      minWidthClassName="min-w-[22rem]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedVendorTab === 'details' && (
              <div className="space-y-8">
                <section className="space-y-4">
                  <h2 className="text-2xl font-medium text-foreground">Overview</h2>
                  <Card className="shadow-card">
                    <CardContent className="space-y-3 py-6">
                      <p className="text-2xl font-semibold text-foreground">{selectedVendor.name}</p>
                      {selectedVendor.phone && <p className="text-lg text-foreground">{selectedVendor.phone}</p>}
                      {selectedVendor.email && <p className="text-lg text-foreground">{selectedVendor.email}</p>}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Badge variant="outline">{selectedVendor.category}</Badge>
                        <Badge variant={vendorSelectionTone(selectedVendor.selection_status)}>
                          {vendorSelectionLabel(selectedVendor.selection_status)}
                        </Badge>
                        <Badge variant={vendorPaymentStatusTone(selectedVendor.payment_status)}>
                          {vendorPaymentStatusLabel(selectedVendor.payment_status)}
                        </Badge>
                      </div>
                      <div className="grid gap-3 pt-4 text-sm text-muted-foreground sm:grid-cols-3">
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-wide">Linked tasks</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">{selectedVendorTasks.length}</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-wide">Payments made</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">{selectedVendorPayments.length}</p>
                        </div>
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs uppercase tracking-wide">Outstanding</p>
                          <p className="mt-1 text-lg font-semibold text-foreground">{formatCurrency(selectedVendorPaymentSummary.balance)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <details className="rounded-[1.4rem] border border-border/70 bg-card shadow-card" open={!selectedVendor.vendor_listing_id}>
                    <summary className="cursor-pointer list-none px-6 py-5">
                      <p className="text-lg font-semibold text-foreground">Invite and pricing intelligence</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Contact setup, claim readiness, and learned price signals for this vendor.
                      </p>
                    </summary>
                    <div className="space-y-5 px-6 pb-6">
                      {!selectedVendor.vendor_listing_id && (
                        <div className="rounded-xl border border-border/70 bg-background p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-xl font-medium text-foreground">Invite this vendor into Zania later</h3>
                              <p className="mt-1 text-sm text-muted-foreground">
                                This stays private to your wedding workspace. Save the vendor's contact details now so the record is ready for delivery in the next step.
                              </p>
                            </div>
                            <Badge variant="outline">
                              {selectedVendorActiveInvite ? `Draft status: ${selectedVendorActiveInvite.invite_status}` : 'No invite draft yet'}
                            </Badge>
                          </div>

                          {workspaceInviteLoadingVendorId === selectedVendor.id ? (
                            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading saved invite details...
                            </div>
                          ) : (
                            <form onSubmit={saveWorkspaceVendorInvite} className="mt-4 space-y-4">
                              <FormSubmitError message={workspaceInviteError} />
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label htmlFor="workspace-vendor-invite-email">Vendor email</Label>
                                  <Input
                                    id="workspace-vendor-invite-email"
                                    type="email"
                                    value={workspaceInviteForm.email}
                                    onChange={(event) => {
                                      setWorkspaceInviteForm((current) => ({ ...current, email: event.target.value }));
                                      setWorkspaceInviteError(null);
                                    }}
                                    placeholder="vendor@example.com"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="workspace-vendor-invite-phone">Vendor phone</Label>
                                  <Input
                                    id="workspace-vendor-invite-phone"
                                    value={workspaceInviteForm.phone}
                                    onChange={(event) => {
                                      setWorkspaceInviteForm((current) => ({ ...current, phone: event.target.value }));
                                      setWorkspaceInviteError(null);
                                    }}
                                    placeholder="+254..."
                                  />
                                </div>
                              </div>
                              <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
                                <div className="space-y-2">
                                  <Label htmlFor="workspace-vendor-invite-message">Invite note</Label>
                                  <Textarea
                                    id="workspace-vendor-invite-message"
                                    value={workspaceInviteForm.message}
                                    onChange={(event) => {
                                      setWorkspaceInviteForm((current) => ({ ...current, message: event.target.value }));
                                      setWorkspaceInviteError(null);
                                    }}
                                    placeholder="A couple has added you to their Zania wedding workspace and would like to invite you in when they are ready."
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="workspace-vendor-invite-expiry">Draft expiry</Label>
                                  <Input
                                    id="workspace-vendor-invite-expiry"
                                    type="date"
                                    value={workspaceInviteForm.expiresAt}
                                    onChange={(event) => {
                                      setWorkspaceInviteForm((current) => ({ ...current, expiresAt: event.target.value }));
                                      setWorkspaceInviteError(null);
                                    }}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Optional for now. Delivery and claim handling comes next.
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm text-muted-foreground">
                                  {selectedVendorInvites.length > 0
                                    ? `${selectedVendorInvites.length} invite record${selectedVendorInvites.length === 1 ? '' : 's'} saved for this vendor.`
                                    : 'No invite records saved yet for this vendor.'}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {selectedVendorActiveInvite ? (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="gap-2"
                                      onClick={() => void sendWorkspaceVendorInviteEmail()}
                                      disabled={workspaceInviteSubmittingVendorId === selectedVendor.id || !selectedVendorActiveInvite.invite_contact_email}
                                    >
                                      {workspaceInviteSubmittingVendorId === selectedVendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                      Send Invite Email
                                    </Button>
                                  ) : null}
                                  <Button
                                    type="submit"
                                    className="gap-2"
                                    disabled={workspaceInviteSubmittingVendorId === selectedVendor.id || !activeWeddingId}
                                  >
                                    {workspaceInviteSubmittingVendorId === selectedVendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    {selectedVendorActiveInvite ? 'Update Invite Draft' : 'Create Invite Draft'}
                                  </Button>
                                </div>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                      <Card className="shadow-none">
                        <CardContent className="space-y-4 py-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">Learned price signal</p>
                            <InfoTip content="Zania blends this vendor's stated range, quotes, invoice-stage amounts, and fully paid outcomes to estimate where the real working price is landing." />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            This gets smarter as more real quotes, invoices, and paid work flow through the platform.
                          </p>
                        </div>
                        {selectedVendorLearningProfile ? (
                          <Badge variant={learningConfidenceTone(selectedVendorLearningProfile.confidence_score)}>
                            {learningConfidenceLabel(selectedVendorLearningProfile.confidence_score)}
                          </Badge>
                        ) : null}
                      </div>

                      {!selectedVendor.vendor_listing_id ? (
                        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                          Link this vendor to a directory listing to learn from their stated price range, commercial quotes, invoices, and receipt-backed outcomes.
                        </div>
                      ) : vendorLearningLoadingListingId === selectedVendor.vendor_listing_id && !selectedVendorLearningProfile ? (
                        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Building the latest vendor pricing profile...
                        </div>
                      ) : selectedVendorLearningProfile ? (
                        <>
                          <div className="grid gap-3 md:grid-cols-4">
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Predicted price</p>
                              <p className="mt-2 text-xl font-semibold text-foreground">
                                {formatCurrency(selectedVendorLearningProfile.predicted_price)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {learningMarketPosition(selectedVendorLearningProfile.predicted_price, selectedVendorActiveBenchmark) ?? 'Waiting for broader market context'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Declared range</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {selectedVendorLearningProfile.declared_min_price != null || selectedVendorLearningProfile.declared_max_price != null
                                  ? `${formatCurrency(selectedVendorLearningProfile.declared_min_price)} - ${formatCurrency(selectedVendorLearningProfile.declared_max_price)}`
                                  : 'Not set'}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Midpoint {formatCurrency(selectedVendorLearningProfile.declared_midpoint_price)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Quote average</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {formatCurrency(selectedVendorLearningProfile.quote_average_amount)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {selectedVendorLearningProfile.quote_observation_count} quote signal{selectedVendorLearningProfile.quote_observation_count === 1 ? '' : 's'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Final paid average</p>
                              <p className="mt-2 text-lg font-semibold text-foreground">
                                {formatCurrency(selectedVendorLearningProfile.final_paid_average_amount)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {selectedVendorLearningProfile.final_paid_observation_count} paid outcome{selectedVendorLearningProfile.final_paid_observation_count === 1 ? '' : 's'}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/70 bg-background px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">How the model is learning</p>
                                <p className="text-sm text-muted-foreground">
                                  {selectedVendorLearningProfile.total_observation_count} weighted pricing signal{selectedVendorLearningProfile.total_observation_count === 1 ? '' : 's'} captured across the platform.
                                </p>
                              </div>
                              <Badge variant="outline">
                                Confidence {selectedVendorLearningProfile.confidence_score}/100
                              </Badge>
                            </div>
                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Booked / invoice stage</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">
                                  {formatCurrency(selectedVendorLearningProfile.booked_average_amount)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {selectedVendorLearningProfile.booked_observation_count} stronger commitment signal{selectedVendorLearningProfile.booked_observation_count === 1 ? '' : 's'}
                                </p>
                              </div>
                              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Quote to paid shift</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">
                                  {selectedVendorLearningProfile.quote_to_paid_delta_percent != null
                                    ? `${selectedVendorLearningProfile.quote_to_paid_delta_percent > 0 ? '+' : ''}${selectedVendorLearningProfile.quote_to_paid_delta_percent}%`
                                    : 'Not enough paid history'}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Shows whether accepted work usually lands above or below early quotes.
                                </p>
                              </div>
                              <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Last refreshed</p>
                                <p className="mt-1 text-sm font-semibold text-foreground">
                                  {selectedVendorLearningProfile.last_observed_at
                                    ? new Date(selectedVendorLearningProfile.last_observed_at).toLocaleDateString()
                                    : 'No live signals yet'}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Updates as this vendor sends new commercial documents or gets paid through Zania.
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                          No learned price signal yet. Once this vendor shares a range, sends a quote, or closes paid work through Zania, this profile will start estimating the real working price.
                        </div>
                      )}
                        </CardContent>
                      </Card>
                    </div>
                  </details>
                </section>

                <details className="rounded-[1.4rem] border border-border/70 bg-card shadow-card">
                  <summary className="cursor-pointer list-none px-6 py-5">
                    <p className="text-lg font-semibold text-foreground">Updates and notes</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Progress notes from the vendor and your private planning notes for this relationship.
                    </p>
                  </summary>
                  <div className="space-y-6 px-6 pb-6">
                    <Card className="shadow-none">
                      <CardContent className="space-y-4 py-6">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">Vendor task suggestions</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Review proposed actions before they become part of the shared wedding plan.
                            </p>
                          </div>
                          <Badge variant="info">Vendor suggestion</Badge>
                        </div>
                        {vendorTaskSuggestionsLoadingId === selectedVendor.id ? (
                          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading suggestions...
                          </div>
                        ) : selectedVendorTaskSuggestions.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                            No task suggestions from this vendor yet.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {selectedVendorTaskSuggestions.map((suggestion) => {
                              const accepting = resolvingVendorTaskSuggestionId === suggestion.id;
                              const accepted = suggestion.status === 'accepted';
                              const dismissed = suggestion.status === 'dismissed';
                              return (
                                <div
                                  key={suggestion.id}
                                  className={`rounded-xl border p-4 transition-[background-color,border-color,box-shadow,transform] duration-200 ease-zania motion-reduce:transition-none ${
                                    accepted || acceptedVendorTaskSuggestionId === suggestion.id
                                      ? 'border-success/35 bg-[hsl(var(--success-soft))] shadow-[0_0_0_4px_hsl(var(--success)/0.06)]'
                                      : dismissed
                                        ? 'border-border/60 bg-muted/20 opacity-70'
                                        : 'border-border/70 bg-background'
                                  }`}
                                >
                                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0 space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={accepted ? 'success' : dismissed ? 'outline' : 'warning'}>
                                          {accepted ? 'Added to plan' : dismissed ? 'Dismissed' : 'Needs review'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(suggestion.created_at).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <p className="font-semibold text-foreground">{suggestion.title}</p>
                                      {suggestion.description ? <p className="text-sm leading-6 text-muted-foreground">{suggestion.description}</p> : null}
                                      {suggestion.suggested_due_date ? (
                                        <p className="text-xs text-muted-foreground">
                                          Suggested due {new Date(`${suggestion.suggested_due_date}T00:00:00`).toLocaleDateString()}
                                        </p>
                                      ) : null}
                                    </div>
                                    {suggestion.status === 'pending' ? (
                                      <div className="flex shrink-0 flex-wrap gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => resolveSelectedVendorTaskSuggestion(suggestion, 'dismiss')}
                                          disabled={accepting}
                                        >
                                          Dismiss
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          status={accepting ? 'loading' : 'idle'}
                                          loadingText="Adding task"
                                          onClick={() => resolveSelectedVendorTaskSuggestion(suggestion, 'accept')}
                                        >
                                          Accept as task
                                        </Button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="shadow-none">
                      <CardContent className="space-y-4 py-6">
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                        Claimed vendors can post structured progress notes here. These stay separate from your private decision notes and from live planning tasks.
                      </div>
                      {vendorWorkspaceUpdatesLoadingId === selectedVendor.id ? (
                        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading vendor updates...
                        </div>
                      ) : selectedVendorWorkspaceUpdates.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                          No vendor updates yet. When this vendor claims their invite and posts progress notes, they will appear here.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedVendorWorkspaceUpdates.map((update) => (
                            <div key={update.id} className="rounded-xl border border-border/70 bg-background p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="gap-1">
                                      <MessageSquareText className="h-3.5 w-3.5" />
                                      Vendor update
                                    </Badge>
                                    <Badge variant={vendorUpdateTone(update.update_type)}>
                                      {vendorWorkspaceUpdateLabel(update.update_type)}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(update.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-sm leading-6 text-foreground">
                                    {update.note_message?.trim() || 'No extra note added.'}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => archiveSelectedVendorWorkspaceUpdate(update.id)}
                                  disabled={archivingVendorWorkspaceUpdateId === update.id}
                                >
                                  {archivingVendorWorkspaceUpdateId === update.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  Dismiss
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      </CardContent>
                    </Card>
                    <Card className="shadow-none">
                      <CardContent className="space-y-4 py-6">
                      <Textarea
                        value={notesDrafts[selectedVendor.id] ?? ''}
                        onChange={(event) => setNotesDrafts((prev) => ({ ...prev, [selectedVendor.id]: event.target.value }))}
                        placeholder="Add notes about this vendor, your impressions, or follow-up items..."
                        className="min-h-40 bg-accent/10 text-base"
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          className="gap-2"
                          onClick={() => updateVendorNotes(selectedVendor)}
                          disabled={savingNotesId === selectedVendor.id}
                        >
                          {savingNotesId === selectedVendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save Notes
                        </Button>
                      </div>
                      </CardContent>
                    </Card>
                  </div>
                </details>
              </div>
            )}

            {selectedVendorTab === 'tasks' && (
              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-2xl font-medium text-foreground">Vendor Tasks - To Do</h2>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          resetVendorTaskForm();
                          setVendorTaskDialogVendor(selectedVendor);
                        }}
                      >
                        <ClipboardList className="h-4 w-4" />
                        Add vendor task
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2"
                        onClick={() => buildVendorTaskBundle(selectedVendor)}
                        disabled={creatingVendorTaskBundleId === selectedVendor.id}
                      >
                        {creatingVendorTaskBundleId === selectedVendor.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        Create task bundle
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {selectedVendorTaskCounts.open.length > 0 ? (
                      selectedVendorTaskCounts.open.map((task) => (
                        <Card key={task.id} className="shadow-card">
                          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div>
                              <Link
                                to={`/tasks?task=${encodeURIComponent(task.id)}`}
                                className="text-xl font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                              >
                                {task.title}
                              </Link>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline">{task.visibility === 'private' ? 'Private' : 'Public'}</Badge>
                                {task.phase && <Badge variant="outline">{vendorMilestoneLabel(task.phase)}</Badge>}
                                {task.due_date && <span>{new Date(task.due_date).toLocaleDateString()}</span>}
                                {task.recommended_role && <span>{task.recommended_role}</span>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Card className="shadow-card">
                        <CardContent className="py-5 text-muted-foreground">No open vendor tasks yet.</CardContent>
                      </Card>
                    )}
                    <Card className="shadow-card">
                      <CardContent className="flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xl font-medium text-foreground">All Tasks</p>
                        <p className="text-xl text-muted-foreground">{selectedVendorTasks.length} total</p>
                      </CardContent>
                    </Card>
                  </div>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-medium text-foreground">Vendor Tasks - Completed</h2>
                  <div className="space-y-4">
                    {selectedVendorTaskCounts.completed.length > 0 ? (
                      selectedVendorTaskCounts.completed.map((task) => (
                        <Card key={task.id} className="opacity-60 shadow-card">
                          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                            <div>
                              <Link
                                to={`/tasks?task=${encodeURIComponent(task.id)}`}
                                className="text-xl font-medium text-foreground line-through underline-offset-4 hover:text-primary hover:underline"
                              >
                                {task.title}
                              </Link>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline">{task.visibility === 'private' ? 'Private' : 'Public'}</Badge>
                                {task.phase && <Badge variant="outline">{vendorMilestoneLabel(task.phase)}</Badge>}
                                {task.due_date && <span>{new Date(task.due_date).toLocaleDateString()}</span>}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Card className="shadow-card">
                        <CardContent className="py-5 text-muted-foreground">No completed vendor tasks yet.</CardContent>
                      </Card>
                    )}
                  </div>
                </section>
              </div>
            )}

            {selectedVendorTab === 'payments' && (
              <div className="space-y-8">
                <section className="space-y-4">
                  <h2 className="text-2xl font-medium text-foreground">Payment Details</h2>
                  <Card className="shadow-card">
                    <CardContent className="py-6">
                      <p className="text-2xl font-semibold text-foreground">{selectedVendor.name}</p>
                      <p className="mt-2 text-lg text-foreground">
                        {selectedVendor.phone ? `M-PESA / Phone: ${selectedVendor.phone}` : 'No payment contact saved yet'}
                      </p>
                    </CardContent>
                  </Card>
                </section>

                <section
                  id={`vendor-payment-plan-${selectedVendor.id}`}
                  tabIndex={-1}
                  className={`space-y-4 rounded-xl transition-[background-color,box-shadow] duration-300 outline-none ${
                    highlightedVendorSection === `vendor-payment-plan-${selectedVendor.id}`
                      ? 'bg-primary/[0.07] shadow-[0_0_0_3px_hsl(var(--primary)/0.28)]'
                      : ''
                  }`}
                >
                  <h2 className="text-2xl font-medium text-foreground">Payment Status</h2>
                  <Card className="shadow-card">
                    <CardContent className="flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <p className="text-2xl text-foreground"><span className="font-semibold">Total Invoice:</span> {formatCurrency(selectedVendorPaymentSummary.invoiceTotal)}</p>
                        <p className="text-2xl font-semibold text-primary">Total Paid: {formatCurrency(selectedVendorPaymentSummary.totalPaid)}</p>
                        <p className="text-2xl font-semibold text-accent-foreground">Balance: {formatCurrency(selectedVendorPaymentSummary.balance)}</p>
                      </div>
                      <Dialog open={recordVendorPaymentOpen} onOpenChange={setRecordVendorPaymentOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" variant="outline">
                            Record a payment made
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle className="font-display">Record Vendor Payment</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={submitVendorPayment} className="space-y-4">
                            <FormSubmitError message={vendorPaymentSubmitError} />
                            <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                              <p className="text-sm font-medium text-foreground">This payment will update the vendor ledger, budget, and paid/balance totals.</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Category: {selectedVendor.category} · Vendor: {selectedVendor.name}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Payee name</Label>
                              <Input
                                value={vendorPaymentForm.payeeName}
                                onChange={(event) =>
                                  {
                                    setVendorPaymentForm((prev) => ({ ...prev, payeeName: event.target.value }));
                                    setVendorPaymentFormErrors((current) => ({ ...current, payeeName: undefined }));
                                    setVendorPaymentSubmitError(null);
                                  }
                                }
                                placeholder="e.g. Little Cake Girl"
                              />
                              <FormFieldError message={vendorPaymentFormErrors.payeeName} />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Amount (KES)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={vendorPaymentForm.amount}
                                  onChange={(event) =>
                                    {
                                      setVendorPaymentForm((prev) => ({ ...prev, amount: event.target.value }));
                                      setVendorPaymentFormErrors((current) => ({ ...current, amount: undefined }));
                                      setVendorPaymentSubmitError(null);
                                    }
                                  }
                                  placeholder="0"
                                  required
                                />
                                <FormFieldError message={vendorPaymentFormErrors.amount} />
                              </div>
                              <div className="space-y-2">
                                <Label>Payment date</Label>
                                <Input
                                  type="date"
                                  value={vendorPaymentForm.paymentDate}
                                  onChange={(event) =>
                                    setVendorPaymentForm((prev) => ({ ...prev, paymentDate: event.target.value }))
                                  }
                                  required
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Reference</Label>
                              <Input
                                value={vendorPaymentForm.reference}
                                onChange={(event) =>
                                  setVendorPaymentForm((prev) => ({ ...prev, reference: event.target.value }))
                                }
                                placeholder="e.g. MPESA Ref: ET546GFDC"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Notes (optional)</Label>
                              <Textarea
                                value={vendorPaymentForm.notes}
                                onChange={(event) =>
                                  setVendorPaymentForm((prev) => ({ ...prev, notes: event.target.value }))
                                }
                                placeholder="Deposit, second payment, balance, or delivery notes..."
                              />
                            </div>
                            <Button type="submit" className="w-full gap-2" disabled={recordingVendorPayment}>
                              {recordingVendorPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                              Record payment
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                </section>

                <section className="space-y-4">
                  <h2 className="text-2xl font-medium text-foreground">Payments Made</h2>
                  <div className="space-y-3">
                    {selectedVendorPayments.length > 0 ? (
                      selectedVendorPayments.map((payment) => (
                        <Card key={payment.id} className="shadow-card">
                          <CardContent className="grid gap-3 py-5 text-lg text-foreground md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
                            <p>{payment.payee_name}</p>
                            <p>{formatCurrency(payment.amount)}</p>
                            <p>{new Date(payment.payment_date).toLocaleDateString()}</p>
                            <p>{payment.reference ? `Ref: ${payment.reference}` : 'No reference'}</p>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <Card className="shadow-card">
                        <CardContent className="py-5 text-muted-foreground">No payments recorded for this vendor yet.</CardContent>
                      </Card>
                    )}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="workspace-h1">Vendors</h1>
          <p className="text-muted-foreground">{vendors.length} vendors tracked</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <UpgradePromptDialog
            open={exportUpgradeOpen}
            onOpenChange={setExportUpgradeOpen}
            decision={exportDecision.allowed ? null : exportDecision}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (!exportDecision.allowed) {
                setExportUpgradeOpen(true);
                return;
              }
              downloadCsv(
                `zania-vendors-${new Date().toISOString().slice(0, 10)}.csv`,
                vendors.map((vendor) => {
                  const recordedPaymentTotal = totalRecordedVendorPayments(vendorPaymentsByVendorId[vendor.id] ?? []);
                  return {
                    vendor_name: vendor.name,
                    category: vendor.category,
                    phone: vendor.phone ?? '',
                    email: vendor.email ?? '',
                    selection_status: vendor.selection_status,
                    payment_status: vendor.payment_status,
                    contract_status: vendor.contract_status,
                    quoted_price_kes: vendor.price ?? '',
                    amount_paid_kes: recordedPaymentTotal,
                    outstanding_kes: vendor.price != null ? Math.max(vendor.price - recordedPaymentTotal, 0) : '',
                    payment_due_date: safeDateLabel(vendor.payment_due_date),
                    open_tasks: (vendorTasksByVendorId[vendor.id] ?? []).filter((task) => !task.completed).length,
                    completed_tasks: (vendorTasksByVendorId[vendor.id] ?? []).filter((task) => task.completed).length,
                    notes: notesDrafts[vendor.id] ?? vendor.notes ?? '',
                  };
                }),
              );
            }}
          >
            <Download className="h-4 w-4" />
            Export Vendors
          </Button>
          {addVendorDialog}
        </div>
      </div>

      {!isPlanner && <CoupleLeadMarketplace weddingId={activeWeddingId} />}

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
                Compare shortlisted vendors in one category at a time using price, trust, payment, notes, and task context.
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
              <div className="min-w-[720px] rounded-xl border border-border/70 bg-background lg:min-w-[860px]">
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
                    const milestones = buildVendorMilestones(vendor, linkedTasks);
                    const completedMilestones = milestones.filter((milestone) => milestone.status === 'complete').length;
                    const nextMilestone = milestones.find((milestone) => milestone.status !== 'complete') ?? null;
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
                            status={savingSelectionId === vendor.id ? 'loading' : selectionSucceededId === vendor.id ? 'success' : 'idle'}
                            loadingText="Updating"
                            successText="Confirmed"
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
                        <div className="mt-3 flex flex-wrap gap-1">
                          {milestones.map((milestone) => (
                            <Badge key={`${vendor.id}-${milestone.phase}`} variant={vendorMilestoneTone(milestone.status)} className="text-[10px]">
                              {milestone.label}
                            </Badge>
                          ))}
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
                          <p>Paid: {formatCurrency(totalRecordedVendorPayments(vendorPaymentsByVendorId[vendor.id] ?? []))}</p>
                          <p>Outstanding: {formatCurrency(Math.max((vendor.price ?? 0) - totalRecordedVendorPayments(vendorPaymentsByVendorId[vendor.id] ?? []), 0))}</p>
                          <p>Owner: {workflowDrafts[vendor.id]?.committeeRoleInCharge === 'unassigned' ? 'Unassigned' : (workflowDrafts[vendor.id]?.committeeRoleInCharge ?? 'Unassigned')}</p>
                          <p>Contract: {contractStatusLabel(workflowDrafts[vendor.id]?.contractStatus ?? vendor.contract_status)}</p>
                          <p>Open tasks: {openLinkedTasks.length}</p>
                          <p>Milestones: {completedMilestones}/{milestones.length} complete</p>
                          <p>Next: {nextMilestone ? nextMilestone.label : 'Workflow complete'}</p>
                          <p>Notes: {notesDrafts[vendor.id]?.trim() ? 'Captured' : 'None yet'}</p>
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
                      {formatCurrency(totalRecordedVendorPayments(vendorPaymentsByVendorId[vendor.id] ?? []))}
                    </div>
                  ))}

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Milestones</div>
                  {decisionWorkspaceVendors.map((vendor) => {
                    const milestones = buildVendorMilestones(vendor, vendorTasksByVendorId[vendor.id] ?? []);
                    const completedMilestones = milestones.filter((milestone) => milestone.status === 'complete').length;
                    return (
                      <div key={`${vendor.id}-milestones`} className="px-4 py-3 text-sm text-foreground">
                        {completedMilestones}/{milestones.length} complete
                      </div>
                    );
                  })}

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Next milestone</div>
                  {decisionWorkspaceVendors.map((vendor) => {
                    const milestones = buildVendorMilestones(vendor, vendorTasksByVendorId[vendor.id] ?? []);
                    const nextMilestone = milestones.find((milestone) => milestone.status !== 'complete') ?? null;
                    return (
                      <div key={`${vendor.id}-next-milestone`} className="px-4 py-3 text-sm text-foreground">
                        {nextMilestone ? nextMilestone.label : 'Workflow complete'}
                      </div>
                    );
                  })}

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Decision notes</div>
                  {decisionWorkspaceVendors.map((vendor) => (
                    <div key={`${vendor.id}-notes`} className="space-y-2 px-4 py-3">
                      <Textarea
                        value={notesDrafts[vendor.id] ?? ''}
                        onChange={(e) => setNotesDrafts((prev) => ({ ...prev, [vendor.id]: e.target.value }))}
                        placeholder="Why this vendor is strong, weak points, negotiation notes, committee concerns..."
                        className="min-h-24 text-sm"
                      />
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-2"
                          onClick={() => updateVendorNotes(vendor)}
                          disabled={savingNotesId === vendor.id}
                        >
                          {savingNotesId === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save notes
                        </Button>
                      </div>
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

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Owner</div>
                  {decisionWorkspaceVendors.map((vendor) => (
                    <div key={`${vendor.id}-owner`} className="px-4 py-3 text-sm text-foreground">
                      {workflowDrafts[vendor.id]?.committeeRoleInCharge === 'unassigned'
                        ? 'Unassigned'
                        : (workflowDrafts[vendor.id]?.committeeRoleInCharge ?? 'Unassigned')}
                    </div>
                  ))}

                  <div className="border-r border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Contract</div>
                  {decisionWorkspaceVendors.map((vendor) => (
                    <div key={`${vendor.id}-contract`} className="px-4 py-3 text-sm text-foreground">
                      {contractStatusLabel(workflowDrafts[vendor.id]?.contractStatus ?? vendor.contract_status)}
                    </div>
                  ))}
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
          const vendorPayments = vendorPaymentsByVendorId[vendor.id] ?? [];
          const recordedPaymentTotal = totalRecordedVendorPayments(vendorPayments);
          const openLinkedTasks = linkedTasks.filter((task) => !task.completed);
          const milestones = buildVendorMilestones(vendor, linkedTasks);
          const nextMilestone = milestones.find((milestone) => milestone.status !== 'complete') ?? null;

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
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Owner & contract</p>
                      <p className="text-sm text-muted-foreground">
                        Record who owns this vendor. Contract progress comes from the signed document workflow.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {contractStatusLabel(workflowDrafts[vendor.id]?.contractStatus ?? vendor.contract_status)}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Role in charge</Label>
                      <Select
                        value={workflowDrafts[vendor.id]?.committeeRoleInCharge ?? 'unassigned'}
                        onValueChange={(value) =>
                          setWorkflowDrafts((prev) => ({
                            ...prev,
                            [vendor.id]: {
                              ...(prev[vendor.id] ?? { committeeRoleInCharge: 'unassigned', contractStatus: vendor.contract_status }),
                              committeeRoleInCharge: value,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="h-10 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {committeeResponsibilityOptions.map((role) => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Contract status</Label>
                      <div className="min-h-10 rounded-md border border-border/70 bg-muted/30 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">
                          {contractStatusLabel(vendor.contract_status)}
                        </p>
                        <Link to="/planner-documents/contracts" className="mt-0.5 inline-block text-xs text-primary hover:underline">
                          Open contract documents
                        </Link>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => updateVendorWorkflow(vendor)}
                      disabled={savingWorkflowId === vendor.id}
                    >
                      {savingWorkflowId === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Ownership
                    </Button>
                  </div>
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
                      <p className="mt-1 text-sm font-medium text-foreground">{formatCurrency(recordedPaymentTotal)}</p>
                    </div>
                    <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {formatCurrency(Math.max((vendor.price ?? 0) - recordedPaymentTotal, 0))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`deposit-${vendor.id}`}>Booking deposit required · Optional</Label>
                      <Input
                        id={`deposit-${vendor.id}`}
                        type="number"
                        value={paymentDrafts[vendor.id]?.depositAmount ?? '0'}
                        onChange={(e) =>
                          setPaymentDrafts((prev) => ({
                            ...prev,
                            [vendor.id]: {
                              ...(prev[vendor.id] ?? { depositAmount: '0', paymentStatus: 'unpaid', paymentDueDate: '' }),
                              depositAmount: e.target.value,
                            },
                          }))
                        }
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">The upfront amount requested to reserve the date; it only counts as paid after a payment is recorded.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Payments recorded</Label>
                      <div className="min-h-10 rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">{formatCurrency(recordedPaymentTotal)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {vendorPayments.length} payment {vendorPayments.length === 1 ? 'record' : 'records'} in the ledger.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Payment status</Label>
                      <div className="min-h-10 rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">
                          {vendorPaymentStatusLabel(deriveVendorPaymentStatus({
                            totalCost: vendor.price,
                            depositRequired: paymentDrafts[vendor.id]?.depositAmount,
                            totalPaid: recordedPaymentTotal,
                          }))}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Calculated from the payment ledger.</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`due-${vendor.id}`}>Next payment due date</Label>
                      <Input
                        id={`due-${vendor.id}`}
                        type="date"
                        value={paymentDrafts[vendor.id]?.paymentDueDate ?? ''}
                        onChange={(e) =>
                          setPaymentDrafts((prev) => ({
                            ...prev,
                            [vendor.id]: {
                              ...(prev[vendor.id] ?? { depositAmount: '0', paymentStatus: 'unpaid', paymentDueDate: '' }),
                              paymentDueDate: e.target.value,
                            },
                          }))
                        }
                      />
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
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Milestone workflow</p>
                      <p className="text-sm text-muted-foreground">
                        Track this vendor through the spreadsheet phases: research, booking, second payment, and closure.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {milestones.filter((milestone) => milestone.status === 'complete').length}/{milestones.length} complete
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {milestones.map((milestone) => (
                      <div key={`${vendor.id}-${milestone.phase}-row`} className="flex items-start justify-between gap-3 rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={vendorMilestoneTone(milestone.status)} className="text-[10px]">
                              {milestone.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {milestone.openTaskCount > 0
                                ? `${milestone.openTaskCount} open task${milestone.openTaskCount === 1 ? '' : 's'}`
                                : milestone.completedTaskCount > 0
                                  ? 'Milestone task closed'
                                  : 'No milestone task yet'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {milestone.nextOpenTask?.title ?? (milestone.status === 'complete' ? 'Milestone complete' : 'Bundle tasks to activate this milestone')}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {milestone.nextOpenTask?.due_date ? `Due ${new Date(milestone.nextOpenTask.due_date).toLocaleDateString()}` : 'No due date'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Next action: {nextMilestone ? nextMilestone.label : 'Workflow complete'}.
                  </p>
                </div>

                <div className="rounded-lg border border-border/70 bg-background px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Decision notes</p>
                      <p className="text-sm text-muted-foreground">
                        Capture shortlist reasoning, negotiation updates, and final selection comments for this vendor.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => updateVendorNotes(vendor)}
                      disabled={savingNotesId === vendor.id}
                    >
                      {savingNotesId === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save notes
                    </Button>
                  </div>
                  <Textarea
                    className="mt-4 min-h-24"
                    value={notesDrafts[vendor.id] ?? ''}
                    onChange={(e) => setNotesDrafts((prev) => ({ ...prev, [vendor.id]: e.target.value }))}
                    placeholder="Add quote comparison notes, contract risks, reasons to shortlist, committee feedback, or why this became the final vendor..."
                  />
                </div>

                <div className="rounded-lg border border-border/70 bg-background px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Related tasks</p>
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
                            <Link
                              to={`/tasks?task=${encodeURIComponent(task.id)}`}
                              className="text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                            >
                              {task.title}
                            </Link>
                            <Badge variant={task.completed ? 'success' : 'outline'} className="text-[10px]">
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
                      {creatingVendorTaskBundleId === vendor.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                      status={savingSelectionId === vendor.id ? 'loading' : selectionSucceededId === vendor.id ? 'success' : 'idle'}
                      loadingText="Updating choice"
                      successText="Final choice confirmed"
                    >
                      <CheckCircle2 className="h-4 w-4" />
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
              <FormSubmitError message={vendorTaskSubmitError} />
              <div className="space-y-2">
                <Label>Vendor category</Label>
                <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm font-medium text-foreground">
                  {vendorTaskDialogVendor.category}
                </div>
                {resolvedVendorTaskDefaults && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      {resolvedVendorTaskDefaults.visibility === 'private' ? 'Private' : 'Public'}
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      P{resolvedVendorTaskDefaults.priorityLevel}
                    </Badge>
                    {resolvedVendorTaskDefaults.delegatable && resolvedVendorTaskDefaults.recommendedRole && (
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        Delegate to {resolvedVendorTaskDefaults.recommendedRole}
                      </Badge>
                    )}
                    {selectedVendorTaskTemplate?.timelineLabel && (
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        {selectedVendorTaskTemplate.timelineLabel}
                      </Badge>
                    )}
                    {selectedVendorTaskTemplate?.phase && (
                      <Badge variant="outline" className="rounded-full text-[11px]">
                        {vendorMilestoneLabel(selectedVendorTaskTemplate.phase)}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Suggested task</Label>
                <Select
                  value={vendorTaskTemplateKey}
                  onValueChange={(value) => {
                    setVendorTaskTemplateKey(value);
                    if (value === 'none') return;
                    const template = vendorTaskSuggestedOptions.find((option) => option.key === value);
                    if (!template) return;
                    setVendorTaskForm((prev) => ({
                      ...prev,
                      title: template.title,
                      description: template.description,
                      assignedTo: prev.assignedTo || template.recommendedRole || '',
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a suggested task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Custom task</SelectItem>
                    {vendorTaskSuggestedOptions.map((template) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedVendorTaskTemplate && (
                  <p className="text-xs text-muted-foreground">
                    {selectedVendorTaskTemplate.description}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Task title</Label>
                <Input
                  value={vendorTaskForm.title}
                  onChange={(event) => {
                    setVendorTaskForm((prev) => ({ ...prev, title: event.target.value }));
                    setVendorTaskFormErrors((current) => ({ ...current, title: undefined }));
                    setVendorTaskSubmitError(null);
                  }}
                  placeholder={selectedVendorTaskTemplate?.title ?? `Confirm contract with ${vendorTaskDialogVendor.name}`}
                  required
                />
                <FormFieldError message={vendorTaskFormErrors.title} />
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
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
