import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, CheckSquare, Users, Store, Heart, LinkIcon, Unlink, CalendarPlus, Clock, ChevronRight, MapPin, Receipt, BriefcaseBusiness, AlertTriangle, ShieldCheck, EyeOff, HandCoins } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import PlannerBrandingBanner from '@/components/PlannerBrandingBanner';
import AttentionInbox from '@/components/AttentionInbox';
import RecentWorkspaceChangesCard from '@/components/RecentWorkspaceChangesCard';
import MyConnections from '@/components/MyConnections';
import PlannerChangeRequestsCard from '@/components/PlannerChangeRequestsCard';
import InfoTip from '@/components/InfoTip';
import { useToast } from '@/hooks/use-toast';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendar';
import { vendorPaymentStatusLabel, vendorPaymentStatusTone } from '@/lib/vendorPayments';
import InlineAssistantCard from '@/components/InlineAssistantCard';
import { useInlineAssistant } from '@/hooks/useInlineAssistant';
import type { EntitlementFeature } from '@/lib/entitlements';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';
import { getMyWeddingOwnershipSummary, type MyWeddingOwnershipSummary } from '@/lib/weddingWorkspace';
import { summarizeContributions, type ContributionSummaryRow } from '@/lib/contributions';
import { WorkspacePageSkeleton } from '@/components/AppLoadingSkeletons';
import { getLabsPath, getSpaceTablePlanPath, isLabsEnabled, isLaunchFeatureEnabled, isSpaceTablePlanEnabled } from '@/lib/featureFlags';
import { buildConciergeContext } from '@/lib/conciergeContext';
import AnimatedNumber from '@/components/AnimatedNumber';
import { compareTasksByWeddingChecklistOrder, getNextWeddingChecklistTask } from '@/lib/weddingTaskTemplates';
import { canonicalizeVendorCategory } from '@/lib/vendorCategories';
import type { AttentionItem } from '@/lib/attention';

interface DashboardStats {
  totalBudget: number;
  totalSpent: number;
  totalTasks: number;
  completedTasks: number;
  totalGuests: number;
  confirmedGuests: number;
  totalVendors: number;
}

interface UpcomingTimelineEvent {
  id: string;
  event_time: string;
  title: string;
  category: string | null;
  assigned_people: string[];
  timeline_title: string;
  timeline_date: string | null;
}

interface FinalVendor {
  id: string;
  name: string;
  category: string;
  price: number | null;
  amount_paid: number;
  payment_status: string;
  payment_due_date: string | null;
}

interface VendorLinkedTask {
  id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  source_vendor_id: string | null;
}

interface BudgetDigestRow {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  budget_scope: 'wedding' | 'personal';
  visibility: 'public' | 'private';
}

interface VendorDigestRow {
  id: string;
  name: string;
  category: string;
  selection_status: string;
  payment_due_date: string | null;
  payment_status: string;
}

interface TaskDigestRow {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  completed: boolean;
  visibility: string;
  phase: string | null;
}

interface ContributionDigestRow extends ContributionSummaryRow {
  id: string;
}

interface DashboardWorkspaceData {
  stats: DashboardStats;
  upcomingEvents: UpcomingTimelineEvent[];
  finalVendors: FinalVendor[];
  vendorLinkedTasks: VendorLinkedTask[];
  budgetDigestRows: BudgetDigestRow[];
  vendorDigestRows: VendorDigestRow[];
  taskDigestRows: TaskDigestRow[];
  contributionRows: ContributionDigestRow[];
}

const EMPTY_DASHBOARD_WORKSPACE_DATA: DashboardWorkspaceData = {
  stats: {
    totalBudget: 0,
    totalSpent: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalGuests: 0,
    confirmedGuests: 0,
    totalVendors: 0,
  },
  upcomingEvents: [],
  finalVendors: [],
  vendorLinkedTasks: [],
  budgetDigestRows: [],
  vendorDigestRows: [],
  taskDigestRows: [],
  contributionRows: [],
};

function guidedTimelineDescription(timelineLabel: string | null) {
  if (!timelineLabel) return 'Continue with the next guided planning step.';
  if (timelineLabel.toLowerCase() === 'wedding day') return 'Plan this for the wedding day.';
  if (timelineLabel.toLowerCase() === 'post wedding') return 'Complete this after the wedding.';
  return `${timelineLabel} before the wedding.`;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadDashboardWorkspace(dataOrFilter: string): Promise<DashboardWorkspaceData> {
  const today = new Date().toISOString().slice(0, 10);
  const [budget, tasks, guests, vendors, finalVendorRows, vendorTaskRows, contributions, timelines] = await Promise.all([
    supabase.from('budget_categories').select('id, name, allocated, spent, budget_scope, visibility').or(dataOrFilter),
    supabase.from('tasks').select('id, title, category, due_date, completed, visibility, phase').or(dataOrFilter),
    supabase.from('guests').select('rsvp_status').or(dataOrFilter),
    supabase.from('vendors').select('id, name, category, selection_status, payment_due_date, payment_status').or(dataOrFilter),
    supabase
      .from('vendors')
      .select('id, name, category, price, amount_paid, payment_status, payment_due_date')
      .or(dataOrFilter)
      .eq('selection_status', 'final')
      .order('category'),
    supabase
      .from('tasks')
      .select('id, title, due_date, completed, source_vendor_id')
      .or(dataOrFilter)
      .not('source_vendor_id', 'is', null)
      .order('due_date', { ascending: true, nullsFirst: false }),
    (supabase as any)
      .from('wedding_contributions')
      .select('id, contributor_name, contribution_type, status, pledged_amount, paid_amount, in_kind_value')
      .or(dataOrFilter),
    supabase
      .from('timelines')
      .select('id, title, timeline_date')
      .or(dataOrFilter)
      .eq('is_template', false)
      .gte('timeline_date', today)
      .order('timeline_date', { ascending: true })
      .limit(1),
  ]);

  if (budget.error) throw budget.error;
  if (tasks.error) throw tasks.error;
  if (guests.error) throw guests.error;
  if (vendors.error) throw vendors.error;
  if (finalVendorRows.error) throw finalVendorRows.error;
  if (vendorTaskRows.error) throw vendorTaskRows.error;
  if (contributions.error) throw contributions.error;
  if (timelines.error) throw timelines.error;

  let upcomingEvents: UpcomingTimelineEvent[] = [];

  if (timelines.data?.length) {
    const timeline = timelines.data[0] as any;
    const { data: eventRows, error: timelineEventsError } = await supabase
      .from('timeline_events')
      .select('id, event_time, title, category, assigned_people')
      .eq('timeline_id', timeline.id)
      .order('event_time', { ascending: true })
      .limit(5);

    if (timelineEventsError) throw timelineEventsError;

    upcomingEvents = (eventRows ?? []).map((event: any) => ({
      ...event,
      timeline_title: timeline.title,
      timeline_date: timeline.timeline_date,
    }));
  }

  const budgetRows = (budget.data ?? []) as any[];
  const taskRows = (tasks.data ?? []) as any[];
  const guestRows = (guests.data ?? []) as any[];
  const vendorRows = (vendors.data ?? []) as any[];
  const contributionDataRows = (contributions.data ?? []) as any[];

  return {
    stats: {
      totalBudget: budgetRows.reduce((sum, row) => sum + Number(row.allocated), 0),
      totalSpent: budgetRows.reduce((sum, row) => sum + Number(row.spent), 0),
      totalTasks: taskRows.length,
      completedTasks: taskRows.filter((task) => task.completed).length,
      totalGuests: guestRows.length,
      confirmedGuests: guestRows.filter((guest) => guest.rsvp_status === 'confirmed').length,
      totalVendors: vendorRows.length,
    },
    budgetDigestRows: budgetRows.map((row) => ({
      ...row,
      allocated: Number(row.allocated ?? 0),
      spent: Number(row.spent ?? 0),
      budget_scope: (row.budget_scope ?? 'wedding') as 'wedding' | 'personal',
      visibility: (row.visibility ?? 'public') as 'public' | 'private',
    })),
    vendorDigestRows: vendorRows.map((row) => ({
      ...row,
      category: canonicalizeVendorCategory(row.category || 'Other'),
      selection_status: row.selection_status ?? 'shortlisted',
      payment_due_date: row.payment_due_date ?? null,
      payment_status: row.payment_status ?? 'not_started',
    })),
    taskDigestRows: taskRows.map((row) => ({
      ...row,
      visibility: row.visibility ?? 'public',
    })),
    contributionRows: contributionDataRows.map((row) => ({
      id: row.id,
      contributor_name: row.contributor_name ?? null,
      contribution_type: row.contribution_type ?? 'cash',
      status: row.status ?? 'pledged',
      pledged_amount: Number(row.pledged_amount ?? 0),
      paid_amount: Number(row.paid_amount ?? 0),
      in_kind_value: Number(row.in_kind_value ?? 0),
    })),
    finalVendors: ((finalVendorRows.data ?? []) as any[]).map((vendor) => ({
      ...vendor,
      amount_paid: Number(vendor.amount_paid ?? 0),
      price: vendor.price != null ? Number(vendor.price) : null,
    })),
    vendorLinkedTasks: (vendorTaskRows.data ?? []) as VendorLinkedTask[],
    upcomingEvents,
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  prep: 'bg-primary/10 text-primary border-primary/20',
  ceremony: 'bg-accent/20 text-foreground border-accent/40',
  reception: 'bg-primary/15 text-foreground border-primary/25',
  transport: 'bg-muted text-muted-foreground border-border',
  photo: 'bg-primary/8 text-primary border-primary/15',
  food: 'bg-accent/15 text-foreground border-accent/30',
  entertainment: 'bg-primary/12 text-primary border-primary/20',
  other: 'bg-muted text-muted-foreground border-border',
};
const CATEGORY_LABELS: Record<string, string> = {
  prep: 'Prep', ceremony: 'Ceremony', reception: 'Reception', transport: 'Transport',
  photo: 'Photo/Video', food: 'Food & Drinks', entertainment: 'Entertainment', other: 'Other',
};

function getDashboardAssistantFeature(role?: string | null, plannerType?: string | null): EntitlementFeature {
  if (role === 'planner' && plannerType === 'committee') return 'committee.ai_assistant';
  if (role === 'planner') return 'planner.ai_assistant';
  return 'couple.ai_assistant';
}

export default function Dashboard() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const { isPlanner, selectedClient, dataOrFilter, linkedPlanner, unlinkPlanner, plannerClientHydrating } = usePlanner();

  useEffect(() => {
    if (location.hash !== '#planner-change-requests' || isPlanner) return;

    const frame = window.requestAnimationFrame(() => {
      const reviewSection = document.getElementById('planner-change-requests');
      reviewSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      reviewSection?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isPlanner, location.hash]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const assistantPanel = useAssistantPanel();
  const isCommittee = profile?.role === 'planner' && profile?.planner_type === 'committee';
  const showPlanningDigest = profile?.role === 'couple' || isCommittee;
  const showSharedWeddingHome = !isPlanner || Boolean(selectedClient);
  const spaceTablePlanEnabled = isSpaceTablePlanEnabled();
  const labsEnabled = isLabsEnabled();
  const [dashboardNudgeDismissed, setDashboardNudgeDismissed] = useState(false);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', user?.id ?? null, selectedClient?.id ?? null, dataOrFilter ?? null],
    queryFn: () => loadDashboardWorkspace(dataOrFilter!),
    enabled: Boolean(user && dataOrFilter),
    staleTime: 45_000,
  });

  const ownershipSummaryQuery = useQuery({
    queryKey: ['dashboard-ownership-summary', user?.id ?? null],
    queryFn: getMyWeddingOwnershipSummary,
    enabled: Boolean(user && !isPlanner && profile?.role === 'couple'),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isPlanner && !plannerClientHydrating && !selectedClient) {
      navigate('/clients');
    }
  }, [isPlanner, plannerClientHydrating, selectedClient, navigate]);

  useEffect(() => {
    if (!dashboardQuery.error) return;

    toast({
      title: 'Dashboard unavailable',
      description: 'Zania could not refresh this workspace summary right now. Try again in a moment.',
      variant: 'destructive',
    });
  }, [dashboardQuery.error, toast]);

  useEffect(() => {
    if (!ownershipSummaryQuery.error) return;

    console.error('Could not load owned wedding summary for dashboard:', ownershipSummaryQuery.error);
  }, [ownershipSummaryQuery.error]);

  const {
    stats,
    upcomingEvents,
    finalVendors,
    vendorLinkedTasks,
    budgetDigestRows,
    vendorDigestRows,
    taskDigestRows,
    contributionRows,
  } = dashboardQuery.data ?? EMPTY_DASHBOARD_WORKSPACE_DATA;

  const ownedWeddingSummary = ownershipSummaryQuery.data ?? null;
  const pageLoading = dashboardQuery.isLoading || ownershipSummaryQuery.isLoading;
  const dashboardRefreshing = dashboardQuery.isFetching && !dashboardQuery.isLoading;

  useEffect(() => {
    if (!dashboardRefreshing) {
      return;
    }

    setDashboardNudgeDismissed(false);
  }, [dashboardRefreshing]);

  const weddingDate = isPlanner && selectedClient
    ? (selectedClient.wedding_date ? new Date(selectedClient.wedding_date) : null)
    : ((profile?.wedding_date || ownedWeddingSummary?.weddingDate)
      ? new Date(profile?.wedding_date || ownedWeddingSummary?.weddingDate || '')
      : null);

  const daysUntil = weddingDate ? Math.max(0, Math.ceil((weddingDate.getTime() - Date.now()) / 86400000)) : null;
  const weddingTitle = isPlanner && selectedClient
    ? [selectedClient.client_name, selectedClient.partner_name].filter(Boolean).join(' & ')
    : ownedWeddingSummary?.weddingName
      || [profile?.full_name, profile?.partner_name].filter(Boolean).join(' & ')
      || profile?.full_name
      || 'Your Wedding';
  const weddingLocation = isPlanner && selectedClient
    ? selectedClient.wedding_location
    : profile?.wedding_location || [ownedWeddingSummary?.locationTown, ownedWeddingSummary?.locationCounty].filter(Boolean).join(', ') || null;
  const weddingMeta = [
    weddingDate ? weddingDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null,
    stats.totalGuests > 0 ? `${stats.totalGuests} guests` : null,
    weddingLocation || null,
  ].filter(Boolean) as string[];
  const contributionSummary = useMemo(
    () => summarizeContributions(contributionRows),
    [contributionRows],
  );
  const contributionCoveragePercentage = stats.totalBudget > 0
    ? Math.min((contributionSummary.totalSupport / stats.totalBudget) * 100, 100)
    : 0;
  const contributionGap = Math.max(stats.totalBudget - contributionSummary.totalSupport, 0);
  const moduleCards = [
    {
      label: 'Budget',
      href: '/budget',
      summary: `KES ${stats.totalSpent.toLocaleString()} spent of ${stats.totalBudget.toLocaleString()}`,
      description: 'Keep real numbers tied to this wedding.',
      icon: Wallet,
    },
    {
      label: 'Timeline',
      href: '/timeline',
      summary: upcomingEvents[0] ? `${upcomingEvents[0].title} at ${upcomingEvents[0].event_time.slice(0, 5)}` : (weddingDate ? `${daysUntil === 0 ? 'Wedding day is here' : `${daysUntil} days to go`}` : 'Set your wedding date'),
      description: 'See what happens next for this wedding.',
      icon: Clock,
    },
    {
      label: 'Vendors',
      href: '/vendors',
      summary: `${stats.totalVendors} vendors tracked`,
      description: 'Quotes, trust scores, and bookings live here.',
      icon: Store,
    },
    {
      label: 'Guests',
      href: '/guests',
      summary: `${stats.confirmedGuests} confirmed of ${stats.totalGuests}`,
      description: 'Guest list, RSVPs, and seating stay together.',
      icon: Users,
    },
    {
      label: 'Contributions',
      href: '/contributions',
      summary: `KES ${contributionSummary.totalSupport.toLocaleString()} raised`,
      description: `${contributionSummary.pendingCount} pledge${contributionSummary.pendingCount === 1 ? '' : 's'} still pending.`,
      icon: HandCoins,
    },
    {
      label: 'Tasks',
      href: '/tasks',
      summary: `${stats.completedTasks} of ${stats.totalTasks} done`,
      description: 'What still needs to happen for this wedding.',
      icon: CheckSquare,
    },
    {
      label: 'Portfolio',
      href: '/portfolio',
      summary: 'Files, vendors, and wedding story',
      description: 'Capture the finished wedding in one place.',
      icon: Heart,
    },
  ];

  const finalVendorMetrics = {
    totalCommitted: finalVendors.reduce((sum, vendor) => sum + (vendor.price ?? 0), 0),
    totalPaid: finalVendors.reduce((sum, vendor) => sum + vendor.amount_paid, 0),
    totalOutstanding: finalVendors.reduce((sum, vendor) => sum + Math.max((vendor.price ?? 0) - vendor.amount_paid, 0), 0),
  };

  const weddingBudgetRows = useMemo(
    () => budgetDigestRows.filter((row) => row.budget_scope === 'wedding'),
    [budgetDigestRows],
  );
  const personalBudgetRows = useMemo(
    () => budgetDigestRows.filter((row) => row.budget_scope === 'personal'),
    [budgetDigestRows],
  );
  const overspentWeddingCategories = useMemo(
    () => weddingBudgetRows.filter((row) => row.allocated > 0 && row.spent > row.allocated),
    [weddingBudgetRows],
  );
  const overspentPersonalCategories = useMemo(
    () => personalBudgetRows.filter((row) => row.allocated > 0 && row.spent > row.allocated),
    [personalBudgetRows],
  );
  const nearLimitCategories = useMemo(
    () => budgetDigestRows
      .filter((row) => row.allocated > 0 && row.spent <= row.allocated && row.spent / row.allocated >= 0.85)
      .sort((left, right) => (right.spent / right.allocated) - (left.spent / left.allocated)),
    [budgetDigestRows],
  );

  const pendingTasks = useMemo(
    () => taskDigestRows.filter((task) => !task.completed),
    [taskDigestRows],
  );
  const coupleTaskAttentionItems = useMemo<AttentionItem[]>(() => {
    const todayKey = localDateKey(new Date());
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 14);
    const horizonKey = localDateKey(horizon);

    return pendingTasks
      .filter((task) => task.due_date && task.due_date <= horizonKey)
      .sort((left, right) => String(left.due_date).localeCompare(String(right.due_date)))
      .map((task) => {
        const overdue = Boolean(task.due_date && task.due_date < todayKey);
        const dueAt = task.due_date ? `${task.due_date}T00:00:00` : null;

        return {
          id: `wedding-home-task:${task.id}`,
          createdAt: dueAt ?? new Date().toISOString(),
          updatedAt: dueAt ?? new Date().toISOString(),
          recipientRole: isPlanner ? 'planner' : 'couple',
          weddingId: null,
          sourceType: 'task',
          sourceId: task.id,
          kind: 'action',
          priority: overdue ? 'urgent' : 'action',
          status: 'read',
          title: task.title,
          summary: overdue ? 'This task is overdue.' : 'This task is due soon.',
          actionLabel: 'Open task',
          actionPath: `/tasks?task=${task.id}`,
          dueAt,
          metadata: {
            wedding_name: weddingTitle,
          },
        };
      });
  }, [isPlanner, pendingTasks, weddingTitle]);
  const privateTasks = useMemo(
    () => pendingTasks.filter((task) => task.visibility === 'private'),
    [pendingTasks],
  );
  const publicTasks = useMemo(
    () => pendingTasks.filter((task) => task.visibility !== 'private'),
    [pendingTasks],
  );
  const nextPrivateTask = useMemo(
    () => [...privateTasks].sort((left, right) => (left.due_date ?? '9999-12-31').localeCompare(right.due_date ?? '9999-12-31'))[0] ?? null,
    [privateTasks],
  );
  const nextPublicTask = useMemo(
    () => [...publicTasks].sort((left, right) => (left.due_date ?? '9999-12-31').localeCompare(right.due_date ?? '9999-12-31'))[0] ?? null,
    [publicTasks],
  );
  const topPendingTasks = useMemo(
    () =>
      [...pendingTasks]
        .sort(compareTasksByWeddingChecklistOrder)
        .slice(0, 3),
    [pendingTasks],
  );
  const nextGuidedRecommendation = useMemo(
    () => getNextWeddingChecklistTask(taskDigestRows),
    [taskDigestRows],
  );
  const nextGuidedTask = nextGuidedRecommendation?.task ?? null;
  const nextGuidedStep = nextGuidedRecommendation?.step ?? null;

  const vendorDecisionsPending = useMemo(() => {
    const byCategory = vendorDigestRows.reduce((summary, vendor) => {
      const category = vendor.category || 'Other';
      const entry = summary[category] ?? { shortlisted: 0, final: 0, backup: 0 };
      switch (vendor.selection_status) {
        case 'final':
          entry.final += 1;
          break;
        case 'backup':
          entry.backup += 1;
          break;
        case 'declined':
          break;
        default:
          entry.shortlisted += 1;
          break;
      }
      summary[category] = entry;
      return summary;
    }, {} as Record<string, { shortlisted: number; final: number; backup: number }>);

    return Object.entries(byCategory)
      .filter(([, counts]) => counts.final === 0 && (counts.shortlisted > 0 || counts.backup > 0))
      .map(([category, counts]) => ({
        category,
        candidates: counts.shortlisted + counts.backup,
      }))
      .sort((left, right) => right.candidates - left.candidates);
  }, [vendorDigestRows]);

  const tasksByVendorId = vendorLinkedTasks.reduce((summary, task) => {
    if (!task.source_vendor_id) return summary;
    summary[task.source_vendor_id] = [...(summary[task.source_vendor_id] ?? []), task];
    return summary;
  }, {} as Record<string, VendorLinkedTask[]>);

  const finalVendorUrgencies = finalVendors
    .map((vendor) => {
      const openTasks = (tasksByVendorId[vendor.id] ?? []).filter((task) => !task.completed);
      const nextTask = [...openTasks].sort((left, right) => (left.due_date ?? '9999-12-31').localeCompare(right.due_date ?? '9999-12-31'))[0] ?? null;
      return {
        ...vendor,
        openTasks,
        nextTask,
        outstanding: Math.max((vendor.price ?? 0) - vendor.amount_paid, 0),
      };
    })
    .sort((left, right) => {
      const leftDue = left.nextTask?.due_date ?? '9999-12-31';
      const rightDue = right.nextTask?.due_date ?? '9999-12-31';
      return leftDue.localeCompare(rightDue);
    });

  const today = new Date();
  const paymentsDueSoon = finalVendorUrgencies.filter((vendor) => {
    if (!vendor.payment_due_date || vendor.payment_status === 'paid_full') return false;
    const dueDate = new Date(vendor.payment_due_date);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
    return diffDays >= 0 && diffDays <= 14;
  });
  const vendorActionCount = finalVendorUrgencies.reduce((sum, vendor) => sum + vendor.openTasks.length, 0);
  const nextVendorAction = finalVendorUrgencies.find((vendor) => vendor.nextTask);
  const dashboardAssistantFeature = useMemo(
    () => getDashboardAssistantFeature(profile?.role, profile?.planner_type),
    [profile?.planner_type, profile?.role],
  );

  const dashboardPrompts = useMemo(() => {
    const prompts: string[] = [];

    if (pendingTasks.length > 0) {
      prompts.push('Summarize what we should focus on this week and turn it into a simple action plan.');
    }

    if (overspentWeddingCategories[0] || overspentPersonalCategories[0] || nearLimitCategories[0]) {
      prompts.push('Review our dashboard and tell me where budget pressure needs attention first.');
    }

    if (vendorDecisionsPending[0]) {
      prompts.push(`Tell me how to close the ${vendorDecisionsPending[0].category} vendor decision next.`);
    }

    if (paymentsDueSoon.length > 0) {
      prompts.push('Review upcoming vendor payment deadlines and tell me what needs action first.');
    }

    if (prompts.length === 0) {
      prompts.push('Give me a quick summary of the next best planning moves for this wedding.');
    }

    return prompts.slice(0, 3);
  }, [
    nearLimitCategories,
    overspentPersonalCategories,
    overspentWeddingCategories,
    paymentsDueSoon,
    pendingTasks.length,
    vendorDecisionsPending,
  ]);

  const homeSetupChecklist = [
    {
      label: 'Wedding profile',
      detail: weddingDate && weddingLocation ? 'Date and location are in place.' : 'Add the date and location so the workspace feels complete.',
      complete: Boolean(weddingDate && weddingLocation),
    },
    {
      label: 'Budget started',
      detail: stats.totalBudget > 0 ? `KES ${stats.totalBudget.toLocaleString()} planned so far.` : 'Set your first budget categories and working totals.',
      complete: stats.totalBudget > 0,
    },
    {
      label: 'Guest list started',
      detail: stats.totalGuests > 0 ? `${stats.totalGuests} guest${stats.totalGuests === 1 ? '' : 's'} already tracked.` : 'Add your first guests to unlock RSVPs and seating.',
      complete: stats.totalGuests > 0,
    },
    {
      label: 'Checklist active',
      detail: stats.totalTasks > 0 ? `${pendingTasks.length} task${pendingTasks.length === 1 ? '' : 's'} still open.` : 'Add your first tasks so the plan has momentum.',
      complete: stats.totalTasks > 0,
    },
    {
      label: 'Timeline started',
      detail: upcomingEvents.length > 0 ? `${upcomingEvents.length} timeline moment${upcomingEvents.length === 1 ? '' : 's'} already visible.` : 'Build the first timeline events for the wedding day.',
      complete: upcomingEvents.length > 0,
    },
    {
      label: 'Vendor decisions moving',
      detail: finalVendorUrgencies.length > 0 ? `${finalVendorUrgencies.length} final vendor${finalVendorUrgencies.length === 1 ? '' : 's'} already confirmed.` : 'Choose final vendors and track payments here.',
      complete: finalVendorUrgencies.length > 0,
    },
  ];

  const completedHomeSetupCount = homeSetupChecklist.filter((item) => item.complete).length;
  const homeSetupPercentage = Math.round((completedHomeSetupCount / homeSetupChecklist.length) * 100);

  const homePrimaryAction: { href: string; label: string; description: string; cta?: string } = (() => {
    if (!isPlanner && (!weddingDate || !weddingLocation)) {
      return {
        href: '/settings',
        label: 'Complete wedding profile',
        description: 'Add your wedding date and location.',
      };
    }

    if (stats.totalTasks === 0) {
      return {
        href: '/tasks',
        label: 'Create first tasks',
        description: 'Start with a short wedding checklist.',
      };
    }

    if (nextGuidedTask && nextGuidedStep) {
      return {
        href: `/tasks?task=${encodeURIComponent(nextGuidedTask.id)}`,
        label: nextGuidedTask.title,
        description: `${guidedTimelineDescription(nextGuidedStep.timelineLabel)} Step ${nextGuidedStep.step} of ${nextGuidedStep.totalSteps} in Zania's guided checklist.`,
        cta: 'Start this step',
      };
    }

    if (stats.totalBudget === 0) {
      return {
        href: '/budget',
        label: 'Start the budget',
        description: 'Add your first budget categories and amounts.',
      };
    }

    if (stats.totalGuests === 0 && isLaunchFeatureEnabled('/guests')) {
      return {
        href: '/guests',
        label: 'Build the guest list',
        description: 'Add the first people you want to invite.',
      };
    }

    if (upcomingEvents.length === 0 && isLaunchFeatureEnabled('/timeline')) {
      return {
        href: '/timeline',
        label: 'Create the timeline',
        description: 'Add the first events for your wedding day.',
      };
    }

    if (finalVendorUrgencies.length === 0) {
      return {
        href: '/vendors',
        label: 'Choose final vendors',
        description: 'Review the vendors you are considering.',
      };
    }

    return {
      href: '/tasks',
      label: 'Review this week',
      description: 'See what needs your attention next.',
    };
  })();

  const dashboardConciergeContext = useMemo(() => buildConciergeContext({
    page: 'Wedding Home',
    role: profile?.role,
    weddingName: weddingTitle,
    primaryGoal: 'Help the couple understand the next best planning move without overwhelming them.',
    nextBestAction: homePrimaryAction.label,
    facts: [
      ['Wedding date countdown', daysUntil === null ? 'No date set' : daysUntil === 0 ? 'Wedding day' : `${daysUntil} days`],
      ['Location', weddingLocation],
      ['Setup progress', `${homeSetupPercentage}%`],
      ['Budget allocated', `KES ${stats.totalBudget.toLocaleString()}`],
      ['Budget spent', `KES ${stats.totalSpent.toLocaleString()}`],
      ['Guests tracked', stats.totalGuests],
      ['Guests confirmed', stats.confirmedGuests],
      ['Open tasks', pendingTasks.length],
      ['Vendors tracked', stats.totalVendors],
      ['Final vendors', finalVendorUrgencies.length],
      ['Funding gap', `KES ${contributionGap.toLocaleString()}`],
    ],
    risks: [
      stats.totalTasks === 0 ? 'No checklist exists yet.' : null,
      stats.totalBudget === 0 ? 'No budget categories are set yet.' : null,
      stats.totalGuests === 0 ? 'Guest list has not started.' : null,
      upcomingEvents.length === 0 ? 'Timeline has not started.' : null,
      vendorDecisionsPending[0] ? `${vendorDecisionsPending[0].category} vendor decision is still open.` : null,
      paymentsDueSoon.length > 0 ? `${paymentsDueSoon.length} vendor payment deadline(s) are due soon.` : null,
    ].filter(Boolean) as string[],
  }), [
    contributionGap,
    daysUntil,
    finalVendorUrgencies.length,
    homePrimaryAction.label,
    homeSetupPercentage,
    paymentsDueSoon.length,
    pendingTasks.length,
    profile?.role,
    stats.completedTasks,
    stats.confirmedGuests,
    stats.totalBudget,
    stats.totalGuests,
    stats.totalSpent,
    stats.totalTasks,
    stats.totalVendors,
    upcomingEvents.length,
    vendorDecisionsPending,
    weddingLocation,
    weddingTitle,
  ]);

  const dashboardAssistant = useInlineAssistant({
    feature: dashboardAssistantFeature,
    page: 'dashboard',
    surface: 'weekly_focus_card',
    conciergeContext: dashboardConciergeContext,
  });
  const dashboardNudge = useMemo(() => {
    if (pendingTasks.length >= 3) {
      return {
        title: `${pendingTasks.length} tasks still need attention`,
        body: 'Get a quick catch-up plan before the week gets away from you.',
        prompt: 'Turn the overdue and pending tasks into a simple catch-up plan for this week.',
      };
    }

    if (overspentWeddingCategories[0] || nearLimitCategories[0]) {
      return {
        title: 'Budget pressure is building',
        body: 'A few categories are over or close to the limit. Get a quick read before you keep spending.',
        prompt: 'Review the dashboard and tell me where budget pressure needs attention first.',
      };
    }

    if (paymentsDueSoon.length > 0) {
      return {
        title: `${paymentsDueSoon.length} vendor payment${paymentsDueSoon.length === 1 ? '' : 's'} due soon`,
        body: 'Check what needs attention before a deadline slips.',
        prompt: 'Review upcoming vendor payment deadlines and tell me what needs action first.',
      };
    }

    return null;
  }, [nearLimitCategories, overspentWeddingCategories, paymentsDueSoon.length, pendingTasks.length]);

  const budgetUsagePercentage = stats.totalBudget > 0
    ? Math.min(Math.round((stats.totalSpent / stats.totalBudget) * 100), 999)
    : 0;
  const taskCompletionPercentage = stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;
  const guestConfirmationPercentage = stats.totalGuests > 0
    ? Math.round((stats.confirmedGuests / stats.totalGuests) * 100)
    : 0;

  const homeActionCards = [
    {
      title: topPendingTasks[0]?.title ?? 'Build your first checklist',
      body: topPendingTasks[0]?.due_date
        ? `Due ${new Date(topPendingTasks[0].due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Keep planning moving by clearing the next visible task.`
        : 'Start with the next planning task so the workspace has an obvious rhythm.',
      href: '/tasks',
      cta: stats.totalTasks > 0 ? 'Open tasks' : 'Create first task',
    },
    {
      title: vendorDecisionsPending[0]
        ? `Close the ${vendorDecisionsPending[0].category} decision`
        : paymentsDueSoon[0]?.name ?? 'Review vendor commitments',
      body: vendorDecisionsPending[0]
        ? `${vendorDecisionsPending[0].candidates} active option${vendorDecisionsPending[0].candidates === 1 ? '' : 's'} still need a final choice.`
        : paymentsDueSoon[0]
          ? `A payment checkpoint is coming up soon for ${paymentsDueSoon[0].name}.`
          : 'Keep bookings, costs, and follow-up tasks tied to the same wedding workspace.',
      href: '/vendors',
      cta: vendorDecisionsPending[0] ? 'Review vendors' : 'Open vendor hub',
    },
    {
      title: upcomingEvents[0]?.title ?? (stats.totalBudget > 0 ? 'Check the funding gap' : 'Start your wedding timeline'),
      body: upcomingEvents[0]
        ? `${upcomingEvents[0].timeline_title} keeps the next moments visible for the whole team.`
        : stats.totalBudget > 0
          ? `Contributions are covering ${Math.round(contributionCoveragePercentage)}% of the current budget.`
          : 'Create the day-of sequence so the plan has a real shape.',
      href: upcomingEvents[0] ? '/timeline' : (stats.totalBudget > 0 ? '/contributions' : '/timeline'),
      cta: upcomingEvents[0] ? 'Open timeline' : (stats.totalBudget > 0 ? 'Open contributions' : 'Create timeline'),
    },
  ];

  const homePulseCards = [
    {
      label: 'Countdown',
      value: daysUntil === null ? 'No date yet' : daysUntil === 0 ? 'Today' : `${daysUntil} days`,
      detail: weddingDate ? 'Until the wedding day arrives.' : 'Set a wedding date to unlock the live countdown.',
      href: !isPlanner && !weddingDate ? '/settings' : '/timeline',
    },
    {
      label: 'Budget health',
      value: stats.totalBudget > 0 ? `${budgetUsagePercentage}% used` : 'Not started',
      detail: stats.totalBudget > 0
        ? `KES ${(stats.totalBudget - stats.totalSpent).toLocaleString()} still available.`
        : 'Create budget categories and totals.',
      href: '/budget',
    },
    {
      label: 'Task progress',
      value: stats.totalTasks > 0 ? `${taskCompletionPercentage}% done` : 'No tasks yet',
      detail: stats.totalTasks > 0
        ? `${pendingTasks.length} task${pendingTasks.length === 1 ? '' : 's'} still open.`
        : 'Build the first checklist items.',
      href: '/tasks',
    },
    {
      label: 'Guest response',
      value: stats.totalGuests > 0 ? `${guestConfirmationPercentage}% confirmed` : 'No guests yet',
      detail: stats.totalGuests > 0
        ? `${stats.confirmedGuests} confirmed of ${stats.totalGuests}.`
        : 'Start the guest list to unlock invites and seating.',
      href: '/guests',
    },
  ];

  const workspaceQuickLinks = [
    { label: 'Budget', href: '/budget', summary: moduleCards[0].summary, icon: Wallet },
    { label: 'Guests', href: '/guests', summary: moduleCards[3].summary, icon: Users },
    { label: 'Tasks', href: '/tasks', summary: moduleCards[5].summary, icon: CheckSquare },
    { label: 'Vendors', href: '/vendors', summary: moduleCards[2].summary, icon: Store },
    { label: 'Timeline', href: '/timeline', summary: moduleCards[1].summary, icon: Clock },
    { label: 'Contributions', href: '/contributions', summary: moduleCards[4].summary, icon: HandCoins },
  ];

  if (isPlanner && (plannerClientHydrating || !selectedClient)) return <WorkspacePageSkeleton />;
  if (pageLoading) return <WorkspacePageSkeleton />;

  if (showSharedWeddingHome) {
    const supportingActions = homeActionCards
      .filter((action) => action.href !== homePrimaryAction.href && isLaunchFeatureEnabled(action.href))
      .slice(0, 2);
    const remainingBudget = stats.totalBudget - stats.totalSpent;

    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="grid gap-4 border-b border-border/70 pb-4 lg:grid-cols-[0.72fr_1.45fr] lg:items-stretch">
          <header className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Wedding Home</p>
            <h1 className="mt-1.5 font-editorial text-3xl font-semibold text-foreground">{weddingTitle}</h1>
            {weddingMeta.length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">{weddingMeta.join(' · ')}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Your wedding plan starts here.</p>
            )}
          </header>

          <Card className="rounded-xl border-primary/25 bg-primary/5 shadow-none">
            <CardContent className="flex h-full flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Do this next</p>
                <h2 className="mt-1.5 line-clamp-2 text-xl font-semibold text-foreground">{homePrimaryAction.label}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{homePrimaryAction.description}</p>
              </div>
              <Button asChild size="sm" className="shrink-0 sm:min-w-32">
                <Link to={homePrimaryAction.href}>{homePrimaryAction.cta ?? homePrimaryAction.label}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <section aria-labelledby="plan-overview-title">
          <h2 id="plan-overview-title" className="text-base font-semibold text-foreground">Your plan</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Link to="/budget" className="rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:border-primary/40">
              <p className="text-sm font-medium text-muted-foreground">Budget</p>
              <p className={`mt-1 text-lg font-semibold ${remainingBudget < 0 ? 'text-destructive' : 'text-foreground'}`}>
                {stats.totalBudget > 0 ? `KES ${Math.abs(remainingBudget).toLocaleString()} ${remainingBudget < 0 ? 'over' : 'left'}` : 'Not started'}
              </p>
              <p className="text-xs text-muted-foreground">{stats.totalBudget > 0 ? `${budgetUsagePercentage}% used` : 'Add your estimate'}</p>
            </Link>
            <Link to="/tasks" className="rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:border-primary/40">
              <p className="text-sm font-medium text-muted-foreground">Tasks</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {stats.totalTasks > 0 ? `${pendingTasks.length} left` : 'Not started'}
              </p>
              <p className="text-xs text-muted-foreground">{stats.totalTasks > 0 ? `${taskCompletionPercentage}% complete` : 'Create your checklist'}</p>
            </Link>
            <Link to="/vendors" className="rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:border-primary/40">
              <p className="text-sm font-medium text-muted-foreground">Vendors</p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {stats.totalVendors > 0 ? `${stats.totalVendors} saved` : 'None saved'}
              </p>
              <p className="text-xs text-muted-foreground">Browse your options</p>
            </Link>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <AttentionInbox
            showEmpty
            maxItems={3}
            compact
            supplementaryItems={coupleTaskAttentionItems}
            onSupplementaryAction={(item) => {
              if (item.actionPath) navigate(item.actionPath);
            }}
          />
          <RecentWorkspaceChangesCard
            maxItems={5}
            compact
          />
        </div>

        {!isPlanner && <PlannerChangeRequestsCard hideWhenEmpty />}

        {supportingActions.length > 0 ? (
          <section aria-labelledby="coming-up-title">
            <h2 id="coming-up-title" className="text-lg font-semibold text-foreground">Coming up</h2>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {supportingActions.map((action) => (
                <div key={action.href} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{action.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{action.body}</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <Link to={action.href}>{action.cta}</Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="border-t border-border/70 pt-4">
          <Link to="/settings" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Wedding settings and planning team
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PlannerBrandingBanner />
      <Card className="overflow-hidden rounded-[34px] border-[#efcfbb] bg-[radial-gradient(circle_at_top_left,rgba(227,144,100,0.15),transparent_26%),radial-gradient(circle_at_top_right,rgba(212,187,125,0.15),transparent_24%),linear-gradient(180deg,rgba(255,252,247,0.98),rgba(250,244,236,0.96))] shadow-[0_26px_70px_rgba(28,22,18,0.07)]">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.95fr] lg:p-8">
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-primary">Wedding Home</p>
                <InfoTip content="This overview keeps your next actions, guests, budget, vendors, and timeline in one place so you can see what needs attention fastest." />
              </div>
              <h1 className="workspace-h1 mt-3">
                {weddingTitle}
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-lg">
                Start with the one action Zania needs from you next. The deeper reports stay tucked away until you need them.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {weddingMeta.length > 0 ? weddingMeta.map((item) => (
                <Badge key={item} variant="outline" className="rounded-full border-[#ead8c8] bg-white/72 px-3 py-1 text-xs shadow-sm">
                  {item}
                </Badge>
              )) : (
                <Badge variant="outline" className="rounded-full border-[#ead8c8] bg-white/72 px-3 py-1 text-xs shadow-sm">
                  Add the wedding basics to complete this snapshot
                </Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[24px] border border-[#d9e5f4] bg-[#f4f8fd]/90 p-4 shadow-[0_12px_30px_rgba(28,22,18,0.04)]">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Countdown</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {daysUntil === null ? 'No date yet' : daysUntil === 0 ? 'Today' : <AnimatedNumber value={daysUntil} suffix=" days" />}
                </p>
              </div>
              <div className="rounded-[24px] border border-[#d9ead7] bg-[#f4fbf3]/90 p-4 shadow-[0_12px_30px_rgba(28,22,18,0.04)]">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Funding gap</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  <AnimatedNumber value={contributionGap} prefix="KES " />
                </p>
              </div>
              <div className="rounded-[24px] border border-[#f0dfc5] bg-[#fff8ec]/95 p-4 shadow-[0_12px_30px_rgba(28,22,18,0.04)]">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Next focus</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {homePrimaryAction.label}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to={homePrimaryAction.href}>{homePrimaryAction.cta ?? homePrimaryAction.label}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/tasks">Open task workspace</Link>
              </Button>
              {weddingDate && (
                <a
                  href={buildGoogleCalendarUrl({
                    title: `${weddingTitle} Wedding`,
                    date: weddingDate.toISOString().slice(0, 10),
                    location: weddingLocation,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="gap-2">
                    <CalendarPlus className="h-4 w-4" />
                    Add to Calendar
                  </Button>
                </a>
              )}
            </div>

            {spaceTablePlanEnabled ? (
              <div className="rounded-[26px] border border-primary/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(248,239,229,0.88))] p-4 shadow-[0_12px_32px_rgba(28,22,18,0.05)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="info" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.16em]">
                        Live
                      </Badge>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary/70">Workspace tool</p>
                    </div>
                    <h2 className="workspace-h2">Open the Space &amp; Table Plan</h2>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      Map tables, stage flow, guest seating, and ceremony zones directly inside the main wedding workspace.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link to={getSpaceTablePlanPath()}>Open Space Plan</Link>
                    </Button>
                    {labsEnabled ? (
                    <Button asChild variant="outline">
                      <Link to={getLabsPath()}>Open Labs</Link>
                    </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-[#ead9c6] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,242,234,0.86))] p-5 shadow-[0_18px_40px_rgba(28,22,18,0.05)] backdrop-blur-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Workspace setup</p>
                  <InfoTip content="These are the core wedding details and planning foundations that make the rest of the workspace more useful." />
                </div>
                <p className="mt-2 text-3xl font-semibold text-foreground">{homeSetupPercentage}%</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {completedHomeSetupCount} of {homeSetupChecklist.length} foundations complete.
                </p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-[linear-gradient(180deg,rgba(255,250,245,0.96),rgba(252,243,235,0.88))] px-3 py-2 text-left shadow-sm sm:text-right">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">Location</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-medium text-foreground">
                  <MapPin className="h-4 w-4 text-primary" />
                  {weddingLocation || 'Add location'}
                </p>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#f0e4d9]">
              <div
                className="h-full rounded-full bg-primary shadow-[0_8px_20px_rgba(216,106,63,0.28)] transition-all"
                style={{ width: `${homeSetupPercentage}%` }}
              />
            </div>

            <div className="mt-5 space-y-3">
              {homeSetupChecklist.filter((item) => !item.complete).slice(0, 3).map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#ebdccb] bg-white/72 p-3 shadow-[0_8px_20px_rgba(28,22,18,0.03)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                    <Badge
                      variant={item.complete ? 'default' : 'outline'}
                      className="shrink-0 rounded-full"
                    >
                      {item.complete ? 'Done' : 'Next'}
                    </Badge>
                  </div>
                </div>
              ))}
              {homeSetupChecklist.every((item) => item.complete) && (
                <div className="rounded-2xl border border-[#d9ead7] bg-[#f4fbf3]/90 p-3 text-sm text-[#2f6f3c] shadow-[0_8px_20px_rgba(28,22,18,0.03)]">
                  The foundations are in place. Use the next move below to keep momentum.
                </div>
              )}
            </div>

            <div className="semantic-surface-info mt-4 rounded-2xl border p-4">
              <p className="text-sm font-medium text-foreground">{homePrimaryAction.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">Best next move right now.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <AttentionInbox
          showEmpty
          maxItems={3}
          supplementaryItems={coupleTaskAttentionItems}
          onSupplementaryAction={(item) => {
            if (item.actionPath) navigate(item.actionPath);
          }}
        />
        <RecentWorkspaceChangesCard maxItems={5} />
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary">Next Best Moves</p>
          <div className="mt-2 flex items-center gap-2">
            <h2 className="workspace-h2">Keep the wedding moving</h2>
            <InfoTip content="These suggested actions update as your workspace changes, so the list reflects what looks most useful right now." />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {homeActionCards.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay: index * 0.035 }}
            >
              <Card className="h-full rounded-[28px] border-[#ead8c7] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,242,235,0.88))] shadow-[0_18px_40px_rgba(28,22,18,0.05)]">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-foreground">{action.title}</p>
                    <p className="text-sm text-muted-foreground">{action.body}</p>
                  </div>
                  <Button asChild variant="outline" className="mt-auto justify-start">
                    <Link to={action.href}>{action.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {!dashboardNudgeDismissed && dashboardNudge && assistantPanel && (
        <Card className="semantic-surface-info shadow-card">
          <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{dashboardNudge.title}</p>
              <p className="text-sm text-muted-foreground">{dashboardNudge.body}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => assistantPanel.openAssistant(dashboardNudge.prompt)}
              >
                Review with AI
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDashboardNudgeDismissed(true)}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!dashboardAssistant.dismissed && (
        <InlineAssistantCard
          title="This week’s planning focus"
          description="One clear recommendation from your current workspace."
          badgeLabel="AI Focus"
          decision={dashboardAssistant.decision}
          canUseAssistant={dashboardAssistant.canUseAssistant}
          prompts={dashboardPrompts}
          response={dashboardAssistant.response}
          error={dashboardAssistant.error}
          loading={dashboardAssistant.loading || dashboardAssistant.usageLoading || dashboardAssistant.accessLoading}
          dismissible
          onDismiss={() => dashboardAssistant.setDismissed(true)}
          onPromptClick={(prompt) => dashboardAssistant.runPrompt(prompt)}
          emptyStateTitle="Get a quick planning read"
          emptyStateBody="Ask for a weekly focus, budget watch, or vendor decision summary without leaving the dashboard."
        />
      )}

      <details className="group rounded-[32px] border border-[#ead8c7] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(250,244,237,0.76))] shadow-[0_18px_44px_rgba(28,22,18,0.05)]">
        <summary className="flex cursor-pointer list-none flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">Reports</p>
              <InfoTip content="Open this when you want the deeper operational view: progress signals, workspace shortcuts, vendor commitments, and planning risks." />
            </div>
            <h2 className="workspace-h2 mt-2">Open the deeper wedding reports</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep the home screen focused, then open the detailed reports only when you need the full picture.
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-white/80 px-3 py-1 text-primary">
            View reports
          </Badge>
        </summary>
        <div className="space-y-8 border-t border-[#ead8c7] p-5 pt-6">
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-[#ead8c7] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,242,235,0.84))] shadow-[0_18px_40px_rgba(28,22,18,0.05)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">Wedding pulse</p>
              <InfoTip content="Use this strip when you want the quickest read on progress before opening a specific workspace." />
            </div>
            <CardTitle className="workspace-h2">One quick read of the whole plan</CardTitle>
            <p className="text-sm text-muted-foreground">
              Four signals that tell you whether the wedding is moving cleanly.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {homePulseCards.map((card) => (
                <Link key={card.label} to={card.href} className="group rounded-2xl border border-border/70 bg-white/72 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{card.value}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.detail}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#ead8c7] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,242,235,0.84))] shadow-[0_18px_40px_rgba(28,22,18,0.05)]">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">Workspaces</p>
              <InfoTip content="Jump straight to the area you need without scanning a full card grid." />
            </div>
            <CardTitle className="workspace-h2">Open the right workspace fast</CardTitle>
            <p className="text-sm text-muted-foreground">
              Quick links to the six places couples need most often.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {workspaceQuickLinks.map((module) => (
                <Link key={module.label} to={module.href} className="group flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-white/72 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <module.icon className="h-4 w-4 text-primary/80" />
                      <p className="text-sm font-medium text-foreground">{module.label}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{module.summary}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linked planner info for couples */}
      {linkedPlanner && !isPlanner && (
        <Card className="semantic-surface-info">
          <CardContent className="flex items-center gap-3 py-4">
            <LinkIcon className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-card-foreground text-sm">
                Linked with {linkedPlanner.plannerName || 'your planner'}
              </p>
              <p className="text-xs text-muted-foreground">Your progress is shared, and planner edits on sensitive areas now wait for your approval.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive gap-1.5 shrink-0"
              onClick={async () => {
                await unlinkPlanner();
                toast({ title: 'Unlinked', description: 'You are no longer linked with this planner.' });
              }}
            >
              <Unlink className="h-3.5 w-3.5" /> Unlink
            </Button>
          </CardContent>
        </Card>
      )}

      {linkedPlanner && !isPlanner && <PlannerChangeRequestsCard />}

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-primary/15 shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="workspace-h2">Vendor Watch</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Track booked vendors, what is still owed, and the next action tied to each final decision.
                </p>
              </div>
              <Receipt className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Final Vendors</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{finalVendorUrgencies.length}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Committed</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">KES {finalVendorMetrics.totalCommitted.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Outstanding</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">KES {finalVendorMetrics.totalOutstanding.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Open Actions</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{vendorActionCount}</p>
              </div>
            </div>

            {finalVendorUrgencies.length > 0 ? (
              <div className="space-y-3">
                {finalVendorUrgencies.slice(0, 4).map((vendor) => (
                  <div key={vendor.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{vendor.name}</p>
                          <Badge variant="outline" className="rounded-full">{vendor.category}</Badge>
                          <Badge variant={vendorPaymentStatusTone(vendor.payment_status)} className="rounded-full">
                            {vendorPaymentStatusLabel(vendor.payment_status)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>Contract: KES {(vendor.price ?? 0).toLocaleString()}</span>
                          <span>Paid: KES {vendor.amount_paid.toLocaleString()}</span>
                          <span>Outstanding: KES {vendor.outstanding.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/vendors">Open Vendor</Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/tasks">View Tasks</Link>
                        </Button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Payment deadline</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {vendor.payment_due_date
                            ? new Date(vendor.payment_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'No due date set'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Next required action</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {vendor.nextTask ? vendor.nextTask.title : 'No open vendor tasks'}
                        </p>
                        {vendor.nextTask?.due_date && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Due {new Date(vendor.nextTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 p-6 text-sm text-muted-foreground">
                No final vendors yet. Shortlist vendors, make a final choice, and this hub will start tracking payments and required actions automatically.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="semantic-surface-info shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="workspace-h3">Timeline And Support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Timeline status</p>
              <p className="mt-2 text-3xl font-semibold text-foreground">
                {upcomingEvents.length > 0 ? upcomingEvents.length : '0'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {upcomingEvents[0]
                  ? `${upcomingEvents[0].title} is the next visible moment.`
                  : 'No live wedding-day timeline events yet.'}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Contributions</p>
              <p className="mt-2 text-base font-medium text-foreground">
                {contributionSummary.totalSupport > 0
                  ? `KES ${contributionSummary.totalSupport.toLocaleString()} raised so far`
                  : 'No support has been logged yet'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {contributionSummary.pendingCount > 0
                  ? `${contributionSummary.pendingCount} pledge${contributionSummary.pendingCount === 1 ? '' : 's'} still pending.`
                  : 'Cash and in-kind help will appear here against the wedding budget.'}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Move this wedding forward</p>
              <div className="mt-3 flex flex-col gap-2">
                <Button asChild className="justify-start gap-2">
                  <Link to="/timeline">
                    <Clock className="h-4 w-4" />
                    Open timeline
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start gap-2">
                  <Link to="/contributions">
                    <HandCoins className="h-4 w-4" />
                    Review contributions
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-start gap-2">
                  <Link to="/vendors">
                    <BriefcaseBusiness className="h-4 w-4" />
                    Review vendor hub
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        {upcomingEvents.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                What Happens Next
                {upcomingEvents[0]?.timeline_date && (
                  <Badge variant="outline" className="text-[10px] font-normal ml-1">
                    {new Date(upcomingEvents[0].timeline_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Badge>
                )}
              </CardTitle>
              <Link to="/timeline" className="text-xs text-primary hover:underline flex items-center gap-0.5">
                Open timeline <ChevronRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingEvents.map((ev, i) => {
                  const formatTime = (t: string) => {
                    const [h, m] = t.split(':');
                    const hour = parseInt(h);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    return `${h12}:${m} ${ampm}`;
                  };
                  const catColor = ev.category && CATEGORY_COLORS[ev.category];
                  const catLabel = ev.category && CATEGORY_LABELS[ev.category];
                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 }}
                      className="flex items-center gap-3 py-1.5"
                    >
                      <span className="text-sm font-semibold text-primary font-display min-w-[70px]">{formatTime(ev.event_time)}</span>
                      <span className="text-sm text-card-foreground">{ev.title}</span>
                      {catColor && catLabel && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${catColor}`}>{catLabel}</span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="semantic-surface-info">
          <CardContent className="space-y-3 py-5">
            <div className="flex items-start gap-4">
              <Heart className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-card-foreground">Collaboration principle</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The wedding runs better when money, people, vendors, and schedule stay tied to the same workspace.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Fastest unblocker</p>
              <p className="mt-2 text-base font-medium text-foreground">
                {vendorDecisionsPending[0]
                  ? `Choose a final ${vendorDecisionsPending[0].category} vendor`
                  : nextPublicTask?.title ?? nextPrivateTask?.title ?? 'Open the wedding workspace'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {vendorDecisionsPending[0]
                  ? `${vendorDecisionsPending[0].candidates} options are still active in that category.`
                  : 'The fastest path forward is the next visible task or payment milestone.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showPlanningDigest && (
        <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-primary/20 shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="workspace-h2">Planning Digest</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Budget pressure, open vendor choices, payment deadlines, and private versus shared work in one place.
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Budget alerts</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {overspentWeddingCategories.length + overspentPersonalCategories.length + nearLimitCategories.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Wedding, personal, and near-limit categories</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Vendor decisions</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{vendorDecisionsPending.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Categories still missing a final vendor</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Private queue</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{privateTasks.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Personal work only your side should see</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Public queue</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{publicTasks.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Shared tasks safe for planners or committee</p>
                </div>
              </div>

              <div className="grid gap-4 2xl:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Budget watch</p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {overspentWeddingCategories[0] && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Wedding overspend</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{overspentWeddingCategories[0].name}</p>
                        <p className="text-xs text-muted-foreground">
                          Over by KES {(overspentWeddingCategories[0].spent - overspentWeddingCategories[0].allocated).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {overspentPersonalCategories[0] && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Personal overspend</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{overspentPersonalCategories[0].name}</p>
                        <p className="text-xs text-muted-foreground">
                          Over by KES {(overspentPersonalCategories[0].spent - overspentPersonalCategories[0].allocated).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {!overspentWeddingCategories[0] && !overspentPersonalCategories[0] && nearLimitCategories[0] && (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Approaching limit</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{nearLimitCategories[0].name}</p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round((nearLimitCategories[0].spent / nearLimitCategories[0].allocated) * 100)}% of budget used
                        </p>
                      </div>
                    )}
                    {!overspentWeddingCategories[0] && !overspentPersonalCategories[0] && !nearLimitCategories[0] && (
                      <p className="text-sm text-muted-foreground">No urgent budget pressure right now.</p>
                    )}
                    <Button asChild variant="outline" size="sm" className="h-auto w-full justify-start gap-2 whitespace-normal py-2 text-left leading-relaxed">
                      <Link to="/budget">
                        <Wallet className="h-4 w-4" />
                        Review budgets
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Decision queue</p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {vendorDecisionsPending.length > 0 ? (
                      vendorDecisionsPending.slice(0, 3).map((item) => (
                        <div key={item.category} className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.category}</p>
                            <p className="text-xs text-muted-foreground">{item.candidates} active options still open</p>
                          </div>
                          <Badge variant="outline" className="rounded-full">{item.candidates}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No unresolved vendor categories right now.</p>
                    )}
                    <Button asChild variant="outline" size="sm" className="h-auto w-full justify-start gap-2 whitespace-normal py-2 text-left leading-relaxed">
                      <Link to="/vendors">
                        <Store className="h-4 w-4" />
                        Open decision workspace
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Queue split</p>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Private next</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{nextPrivateTask?.title ?? 'No private tasks pending'}</p>
                      {nextPrivateTask?.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due {new Date(nextPrivateTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Public next</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{nextPublicTask?.title ?? 'No public tasks pending'}</p>
                      {nextPublicTask?.due_date && (
                        <p className="text-xs text-muted-foreground">
                          Due {new Date(nextPublicTask.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Payment deadlines</p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {paymentsDueSoon.length > 0 ? `${paymentsDueSoon.length} vendor payment${paymentsDueSoon.length === 1 ? '' : 's'} due in 14 days` : 'No payment deadlines in the next 14 days'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button asChild variant="outline" size="sm" className="h-auto w-full justify-start gap-2 whitespace-normal py-2 text-left leading-relaxed">
                        <Link to="/tasks">
                          <CheckSquare className="h-4 w-4" />
                          Open tasks
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm" className="h-auto w-full justify-start gap-2 whitespace-normal py-2 text-left leading-relaxed">
                        <Link to="/vendors">
                          <EyeOff className="h-4 w-4" />
                          Review payments
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="semantic-surface-info">
            <CardHeader className="pb-3">
              <CardTitle className="workspace-h3">What your side should handle next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Private matters</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {privateTasks.length > 0 ? `${privateTasks.length} private task${privateTasks.length === 1 ? '' : 's'} still need attention` : 'Private decisions are caught up'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep attire, health prep, dowry, honeymoon, and other private work out of the shared queue.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Shared planning</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {publicTasks.length > 0 ? `${publicTasks.length} shared task${publicTasks.length === 1 ? '' : 's'} are still open` : 'Shared planning tasks are in good shape'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  These are the actions you can safely coordinate with a planner or committee without mixing in private work.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Fastest unblocker</p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {vendorDecisionsPending[0]
                    ? `Choose a final ${vendorDecisionsPending[0].category} vendor`
                    : nextPublicTask?.title ?? nextPrivateTask?.title ?? 'Open the wedding workspace'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {vendorDecisionsPending[0]
                    ? `${vendorDecisionsPending[0].candidates} options are still active in that category.`
                    : 'The fastest path forward is the next visible task or payment milestone.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
        </div>
      </details>

      {/* My Connections — couples only */}
      {!isPlanner && <MyConnections />}
    </div>
  );
}
