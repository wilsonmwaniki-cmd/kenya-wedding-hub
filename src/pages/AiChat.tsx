import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, Send, Sparkles, Wand2, Wallet, CalendarClock, Users, Store, BriefcaseBusiness, CheckSquare2, BellRing, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { getEntitlementDecision, type EntitlementDecision, type EntitlementFeature } from '@/lib/entitlements';
import { InlineUpgradePrompt, UpgradePromptDialog } from '@/components/UpgradePrompt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PendingWriteAction {
  toolName: string;
  args: Record<string, unknown>;
  summary: string;
  destructive: boolean;
}

interface VendorListingAccess {
  id: string;
  is_approved: boolean;
  is_verified: boolean;
  verification_requested: boolean;
  subscription_status: string;
  subscription_expires_at: string | null;
}

interface AiUsageStatus {
  audience: string;
  monthly_message_cap: number;
  messages_used: number;
  remaining_messages: number;
  month_start: string;
  ai_enabled: boolean;
  add_on_separate: boolean;
  add_on_lookup_key: string | null;
  add_on_annual_lookup_key: string | null;
}

interface AssistantExperience {
  name: string;
  subtitle: string;
  intro: string;
  inputPlaceholder: string;
  starterActions: string[];
  capabilityCards: Array<{
    icon: typeof Wand2;
    title: string;
    description: string;
  }>;
}

interface WorkspaceSnapshot {
  overdueTasks: number;
  pendingTasks: number;
  pendingGuests: number;
  confirmedGuests: number;
  trackedVendors: number;
  finalVendors: number;
  budgetAllocated: number;
  budgetSpent: number;
  paymentRecords: number;
  openVendorFollowUps: number;
  vendorBookings: number;
  nextDueTaskTitle: string | null;
  highestBudgetCategory: string | null;
  mostUrgentVendorCategory: string | null;
}

function formatAssistantContent(content: string) {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  if (/[#*\-\d]\s/.test(normalized) || normalized.includes('## ')) return normalized;

  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return normalized;

  const bulletLike = lines.slice(1).every((line) => line.length > 0 && line.length <= 180);
  if (!bulletLike) return normalized;

  return [lines[0], '', ...lines.slice(1).map((line) => `- ${line}`)].join('\n');
}

function formatActionLabel(toolName: string) {
  return toolName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getAssistantFeature(profileRole?: string | null, plannerType?: string | null): EntitlementFeature {
  if (profileRole === 'vendor') return 'vendor.ai_assistant';
  if (profileRole === 'planner' && plannerType === 'committee') return 'committee.ai_assistant';
  if (profileRole === 'planner') return 'planner.ai_assistant';
  return 'couple.ai_assistant';
}

function getSmartStarterActions(
  role?: string | null,
  plannerType?: string | null,
  snapshot?: WorkspaceSnapshot | null,
  selectedClientName?: string | null,
) {
  if (!snapshot) return null;

  if (role === 'vendor') {
    const actions: string[] = [];
    if (snapshot.openVendorFollowUps > 0) actions.push('Summarize my open follow-up reminders and tell me who I should contact first.');
    if (snapshot.vendorBookings > 0) actions.push('Review my current bookings and tell me which booking status updates I should make next.');
    actions.push('Draft a short sales plan for my most active bookings this week.');
    return actions.slice(0, 3);
  }

  if (role === 'planner' && plannerType === 'committee') {
    const actions: string[] = [];
    if (snapshot.overdueTasks > 0) actions.push('Turn my overdue committee tasks into a delegation plan for this week.');
    if (snapshot.trackedVendors > snapshot.finalVendors && snapshot.mostUrgentVendorCategory) {
      actions.push(`Tell me how the committee should close the remaining ${snapshot.mostUrgentVendorCategory} vendor decisions.`);
    }
    actions.push('Create a committee action list for the next two weeks based on the current workspace.');
    return actions.slice(0, 3);
  }

  if (role === 'planner') {
    const actions: string[] = [];
    if (snapshot.overdueTasks > 0) {
      actions.push(
        selectedClientName
          ? `Summarize overdue blockers for ${selectedClientName} and turn them into a next-7-days plan.`
          : 'Summarize overdue blockers and turn them into a next-7-days plan.',
      );
    }
    if (snapshot.trackedVendors > snapshot.finalVendors && snapshot.mostUrgentVendorCategory) {
      actions.push(`Review the ${snapshot.mostUrgentVendorCategory} vendor decision and tell me what to do next.`);
    }
    if (snapshot.paymentRecords === 0 && snapshot.budgetAllocated > 0) {
      actions.push('Review this wedding budget and tell me what payments or allocations need attention first.');
    }
    return actions.slice(0, 3);
  }

  const actions: string[] = [];
  if (snapshot.overdueTasks > 0) actions.push('What overdue tasks should we tackle first this week?');
  if (snapshot.trackedVendors > snapshot.finalVendors && snapshot.mostUrgentVendorCategory) {
    actions.push(`Turn our ${snapshot.mostUrgentVendorCategory} vendor decision into concrete next steps.`);
  }
  if (snapshot.budgetAllocated > 0 && snapshot.budgetSpent >= snapshot.budgetAllocated * 0.8 && snapshot.highestBudgetCategory) {
    actions.push(`Review our ${snapshot.highestBudgetCategory} budget and tell me where we may be overspending.`);
  }
  if (snapshot.pendingGuests > 0) actions.push('Help me decide what to do next with the guest list and RSVP follow-ups.');

  return actions.slice(0, 3);
}

function getAssistantExperience(
  role?: string | null,
  plannerType?: string | null,
  selectedClientName?: string | null,
  snapshot?: WorkspaceSnapshot | null,
): AssistantExperience {
  if (role === 'vendor') {
    const starterActions = getSmartStarterActions(role, plannerType, snapshot, selectedClientName) ?? [
      'Review my open bookings and tell me which ones need follow-up first.',
      'Create a follow-up reminder for the next booking that needs a callback.',
      'Help me update a booking status after a client conversation.',
    ];
    return {
      name: 'Vendor Sales & Booking Assistant',
      subtitle: 'Helps you stay on top of bookings, follow-ups, internal notes, and booking status updates.',
      intro:
        "Habari! I'm your premium vendor sales and booking assistant. I can review your booking pipeline, suggest next actions, save private internal notes, create follow-up reminders, and update booking statuses inside Zania.",
      inputPlaceholder: "Try: 'Review my open bookings and create a follow-up reminder for the next couple I should call'",
      starterActions,
      capabilityCards: [
        {
          icon: Store,
          title: 'Listing and positioning guidance',
          description: 'Spot weak profile details, missing trust signals, and listing improvements that help more couples convert.',
        },
        {
          icon: BellRing,
          title: 'Follow-up reminders',
          description: 'Create private reminders so booking follow-ups, callbacks, and delivery prep do not get lost.',
        },
        {
          icon: Wallet,
          title: 'Booking and payment clarity',
          description: 'Summarize booking value, payment history, balances, and next commercial actions at a glance.',
        },
      ],
    };
  }

  if (role === 'planner' && plannerType === 'committee') {
    const starterActions = getSmartStarterActions(role, plannerType, snapshot, selectedClientName) ?? [
      'What should the committee delegate next this month?',
      'Summarize overdue tasks, vendor follow-ups, and payment risks.',
      'Create a committee action list for the next two weeks.',
    ];
    return {
      name: 'Committee Delegation Assistant',
      subtitle: 'Keeps committee-led weddings organized around delegation, accountability, vendors, and execution.',
      intro:
        "Habari! I'm your premium committee delegation assistant. I can help your team coordinate vendors, budgets, tasks, timelines, and delegated responsibilities across the wedding workspace.",
      inputPlaceholder: "Try: 'What should the committee delegate next and which deadlines look risky?'",
      starterActions,
      capabilityCards: [
        {
          icon: Users,
          title: 'Delegation support',
          description: 'Recommend who should own the next actions and where the committee should focus first.',
        },
        {
          icon: CheckSquare2,
          title: 'Execution coordination',
          description: 'Turn next steps into practical, delegated work across tasks, vendors, and budget decisions.',
        },
        {
          icon: CalendarClock,
          title: 'Timeline awareness',
          description: 'See what is overdue, what is coming up next, and where the wedding could slip.',
        },
      ],
    };
  }

  if (role === 'planner') {
    const starterActions = getSmartStarterActions(role, plannerType, snapshot, selectedClientName) ?? [
      selectedClientName
        ? `Summarize blockers for ${selectedClientName} and tell me what I should handle next.`
        : 'Summarize the biggest blockers in my active wedding workspace.',
      'Create a next-7-days action plan for this wedding.',
      'Review vendor, payment, and timeline risks for me.',
    ];
    return {
      name: 'Planner Operations Copilot',
      subtitle: 'Built for fast client operations across tasks, budgets, vendors, payments, and timelines.',
      intro:
        "Habari! I'm your premium planner operations copilot. I can reason across client tasks, budgets, vendors, payments, guests, and timelines, and I can take planning actions inside the selected wedding workspace.",
      inputPlaceholder:
        selectedClientName
          ? `Try: 'Summarize blockers for ${selectedClientName} and turn the next week into actions'`
          : "Try: 'Give me a planner-level summary of the biggest risks and next actions'",
      starterActions,
      capabilityCards: [
        {
          icon: BriefcaseBusiness,
          title: 'Client operations view',
          description: 'See blockers, priorities, vendor pressure points, and execution risk in one assistant flow.',
        },
        {
          icon: Wallet,
          title: 'Budget and payment actions',
          description: 'Record payments, update budget lines, and keep the client workspace commercially accurate.',
        },
        {
          icon: CalendarClock,
          title: 'Execution pacing',
          description: 'Plan the next week clearly, spot overdue work, and keep the wedding moving on schedule.',
        },
      ],
    };
  }

  const starterActions = getSmartStarterActions(role, plannerType, snapshot, selectedClientName) ?? [
    'What should we focus on next this month?',
    'Review my budget and tell me where I might be overspending.',
    'Turn my next vendor decisions into concrete tasks.',
  ];
  return {
    name: 'Couple Planning Coach',
    subtitle: 'A calm, workspace-aware wedding coach that can guide and act inside your real plan.',
    intro:
      "Habari! I'm your premium couple planning coach. I can advise you using your real Zania data and help manage tasks, vendors, guests, payments, budget, and timelines for your wedding.",
    inputPlaceholder: "Try: 'What should we focus on next this month, and what should we spend time on first?'",
    starterActions,
    capabilityCards: [
      {
        icon: Wand2,
        title: 'Advice tied to your real wedding workspace',
        description: 'Answer based on your tasks, vendors, budget, payments, guests, and timelines instead of generic wedding advice.',
      },
      {
        icon: Wallet,
        title: 'Hands-on planning actions',
        description: 'Create tasks, add vendors, update budgets, and record payment activity when you ask for concrete help.',
      },
      {
        icon: CalendarClock,
        title: 'Execution support',
        description: 'Help you understand what comes next, what is overdue, and what needs attention before the wedding day.',
      },
    ],
  };
}

export default function AiChat() {
  const { session, profile, baseProfile, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const { isPlanner, selectedClient, dataOrFilter } = usePlanner();
  const [vendorListing, setVendorListing] = useState<VendorListingAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<AiUsageStatus | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<PendingWriteAction[]>([]);
  const [confirmingWriteActions, setConfirmingWriteActions] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const feature = useMemo(
    () => getAssistantFeature(profile?.role, profile?.planner_type),
    [profile?.planner_type, profile?.role],
  );

  const decision = useMemo<EntitlementDecision | null>(() => {
    if (!profile) return null;
    return getEntitlementDecision(feature, {
      profile,
      vendorListing,
      bypass: isSuperAdmin || baseProfile?.role === 'admin',
    });
  }, [baseProfile?.role, feature, isSuperAdmin, profile, vendorListing]);

  const experience = useMemo(
    () => getAssistantExperience(profile?.role, profile?.planner_type, selectedClient?.client_name ?? null, workspaceSnapshot),
    [profile?.planner_type, profile?.role, selectedClient?.client_name, workspaceSnapshot],
  );

  useEffect(() => {
    if (profile && messages.length === 0 && experience.intro) {
      setMessages([{ role: 'assistant', content: experience.intro }]);
    }
  }, [experience.intro, messages.length, profile]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    const loadVendorListing = async () => {
      if (profile?.role !== 'vendor' || isSuperAdmin || baseProfile?.role === 'admin') {
        setVendorListing(null);
        return;
      }

      setAccessLoading(true);
      const { data, error } = await supabase
        .from('vendor_listings')
        .select('id, is_approved, is_verified, verification_requested, subscription_status, subscription_expires_at')
        .eq('user_id', profile.user_id)
        .maybeSingle();

      if (!cancelled) {
        if (error) {
          console.error('Failed to load vendor assistant access state:', error);
          setVendorListing(null);
        } else {
          setVendorListing((data as VendorListingAccess | null) ?? null);
        }
        setAccessLoading(false);
      }
    };

    void loadVendorListing();

    return () => {
      cancelled = true;
    };
  }, [baseProfile?.role, isSuperAdmin, profile?.role, profile?.user_id]);

  useEffect(() => {
    let cancelled = false;

    const loadUsage = async () => {
      if (!session || !decision?.allowed) {
        setUsage(null);
        return;
      }

      setUsageLoading(true);
      const { data, error } = await (supabase.rpc as any)('get_ai_usage_status');
      if (!cancelled) {
        if (error) {
          console.error('Failed to load AI usage status:', error);
        } else {
          setUsage((Array.isArray(data) ? data[0] : data) ?? null);
        }
        setUsageLoading(false);
      }
    };

    void loadUsage();

    return () => {
      cancelled = true;
    };
  }, [decision?.allowed, session]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspaceSnapshot = async () => {
      if (!session || !decision?.allowed || !profile) {
        setWorkspaceSnapshot(null);
        return;
      }

      setSnapshotLoading(true);

      if (profile.role === 'vendor' && vendorListing) {
        const [bookingsRes, followUpsRes] = await Promise.all([
          supabase
            .from('vendors')
            .select('id, category, status')
            .eq('vendor_listing_id', vendorListing.id)
            .limit(100),
          supabase
            .from('vendor_follow_up_reminders')
            .select('id, status')
            .eq('vendor_listing_id', vendorListing.id)
            .limit(100),
        ]);

        if (!cancelled) {
          const bookings = bookingsRes.data ?? [];
          const followUps = followUpsRes.data ?? [];
          const categoryCounts = bookings.reduce<Record<string, number>>((acc, booking: any) => {
            const key = booking.category || 'booking';
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {});
          const mostUrgentVendorCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

          setWorkspaceSnapshot({
            overdueTasks: 0,
            pendingTasks: 0,
            pendingGuests: 0,
            confirmedGuests: 0,
            trackedVendors: 0,
            finalVendors: 0,
            budgetAllocated: 0,
            budgetSpent: 0,
            paymentRecords: 0,
            openVendorFollowUps: followUps.filter((item: any) => item.status !== 'completed').length,
            vendorBookings: bookings.length,
            nextDueTaskTitle: null,
            highestBudgetCategory: null,
            mostUrgentVendorCategory,
          });
          setSnapshotLoading(false);
        }
        return;
      }

      if (!dataOrFilter) {
        setWorkspaceSnapshot(null);
        setSnapshotLoading(false);
        return;
      }

      const [tasksRes, budgetRes, paymentsRes, guestsRes, vendorsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('title, due_date, completed, category')
          .or(dataOrFilter)
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(100),
        supabase
          .from('budget_categories')
          .select('name, allocated, spent')
          .or(dataOrFilter)
          .limit(100),
        supabase
          .from('budget_payments')
          .select('id')
          .or(dataOrFilter)
          .limit(100),
        supabase
          .from('guests')
          .select('rsvp_status')
          .or(dataOrFilter)
          .limit(200),
        supabase
          .from('vendors')
          .select('category, selection_status')
          .or(dataOrFilter)
          .limit(100),
      ]);

      if (!cancelled) {
        const tasks = tasksRes.data ?? [];
        const budgetCategories = budgetRes.data ?? [];
        const guests = guestsRes.data ?? [];
        const vendors = vendorsRes.data ?? [];
        const categorySpend = budgetCategories
          .map((item: any) => ({
            name: item.name as string,
            ratio: Number(item.allocated || 0) > 0 ? Number(item.spent || 0) / Number(item.allocated || 0) : 0,
          }))
          .sort((a, b) => b.ratio - a.ratio);
        const vendorCounts = vendors.reduce<Record<string, number>>((acc, vendor: any) => {
          if (vendor.selection_status === 'final') return acc;
          const key = vendor.category || 'vendor';
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {});

        setWorkspaceSnapshot({
          overdueTasks: tasks.filter((task: any) => !task.completed && task.due_date && task.due_date < new Date().toISOString().slice(0, 10)).length,
          pendingTasks: tasks.filter((task: any) => !task.completed).length,
          pendingGuests: guests.filter((guest: any) => guest.rsvp_status === 'pending').length,
          confirmedGuests: guests.filter((guest: any) => guest.rsvp_status === 'confirmed').length,
          trackedVendors: vendors.length,
          finalVendors: vendors.filter((vendor: any) => vendor.selection_status === 'final').length,
          budgetAllocated: budgetCategories.reduce((sum: number, item: any) => sum + Number(item.allocated || 0), 0),
          budgetSpent: budgetCategories.reduce((sum: number, item: any) => sum + Number(item.spent || 0), 0),
          paymentRecords: (paymentsRes.data ?? []).length,
          openVendorFollowUps: 0,
          vendorBookings: 0,
          nextDueTaskTitle: tasks.find((task: any) => !task.completed && task.due_date)?.title ?? null,
          highestBudgetCategory: categorySpend[0]?.name ?? null,
          mostUrgentVendorCategory: Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        });
        setSnapshotLoading(false);
      }
    };

    void loadWorkspaceSnapshot();

    return () => {
      cancelled = true;
    };
  }, [dataOrFilter, decision?.allowed, profile, session, vendorListing]);

  const sendMessage = async (
    nextInput: string,
    options?: { allowWriteActions?: boolean; confirmedActions?: PendingWriteAction[]; skipUserEcho?: boolean },
  ) => {
    if (!nextInput.trim() || loading) return;

    if (!session?.access_token) {
      toast({
        title: 'Sign in again',
        description: 'Your session is missing or expired for this workspace. Please sign out and sign back in.',
        variant: 'destructive',
      });
      return;
    }

    if (!decision?.allowed) {
      setUpgradeOpen(true);
      return;
    }

    if (usage && usage.remaining_messages <= 0) {
      toast({
        title: 'Monthly AI limit reached',
        description: 'This account has used its AI allowance for the current month.',
        variant: 'destructive',
      });
      return;
    }

    const shouldEchoUser = !options?.skipUserEcho;
    const userMsg: Message = { role: 'user', content: nextInput.trim() };
    const updatedMessages = shouldEchoUser ? [...messages, userMsg] : messages;
    if (shouldEchoUser) {
      setPendingActions([]);
    }
    if (shouldEchoUser) {
      setMessages(updatedMessages);
    }
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('wedding-ai-chat', {
        body: {
          messages: updatedMessages.map((message) => ({ role: message.role, content: message.content })),
          selectedClientId: isPlanner ? selectedClient?.id ?? null : null,
          allowWriteActions: options?.allowWriteActions ?? false,
          confirmedActions: options?.confirmedActions ?? [],
        },
      });

      if (error) {
        let parsedError: any = null;
        let statusCode: number | null = null;
        let fallbackError = error.message || 'Request failed';

        const maybeContext = (error as { context?: Response }).context;
        if (maybeContext instanceof Response) {
          statusCode = maybeContext.status;
          const rawError = await maybeContext.text();

          parsedError = (() => {
            try {
              const parsed = JSON.parse(rawError);
              if (parsed && typeof parsed === 'object') {
                const primaryMessage =
                  typeof parsed.error === 'string'
                    ? parsed.error
                    : typeof parsed.message === 'string'
                      ? parsed.message
                      : typeof parsed.details === 'string'
                        ? parsed.details
                        : null;

                return primaryMessage ? { ...parsed, error: primaryMessage } : parsed;
              }

              return parsed;
            } catch {
              return rawError.trim() ? { error: rawError.trim() } : null;
            }
          })();

          fallbackError =
            parsedError?.error ||
            parsedError?.message ||
            parsedError?.details ||
            (rawError.trim()
              ? rawError.trim()
              : `Request failed with status ${maybeContext.status}${maybeContext.statusText ? ` (${maybeContext.statusText})` : ''}`);
        } else if (fallbackError === 'Failed to send a request to the Edge Function') {
          fallbackError = 'Could not reach the AI function. Please try again in a few moments.';
        }

        if (parsedError?.usage) {
          setUsage(parsedError.usage as AiUsageStatus);
        }

        if (statusCode === 402 || statusCode === 403) {
          setUpgradeOpen(true);
        }

        toast({
          title:
            statusCode === 402
              ? 'Premium feature'
              : statusCode === 429
                ? 'Monthly AI limit reached'
                : 'AI Error',
          description: fallbackError,
          variant: 'destructive',
        });
        return;
      }

      const content = data.content || 'Sorry, I could not generate a response.';
      const nextPendingActions = Array.isArray(data.pendingActions) ? (data.pendingActions as PendingWriteAction[]) : [];
      if (data.usage) {
        setUsage(data.usage as AiUsageStatus);
      }
      setPendingActions(nextPendingActions);
      setMessages((prev) => [...prev, { role: 'assistant', content }]);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Connection Error',
        description: 'Could not reach the AI assistant.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendMessage(input);
  };

  const handleStarterAction = async (prompt: string) => {
    setInput(prompt);
    await sendMessage(prompt);
  };

  const runPendingActions = async () => {
    if (!pendingActions.length || loading) return;

    setConfirmingWriteActions(true);
    try {
      await sendMessage(
        'Please run the confirmed actions now and summarize what changed.',
        {
          allowWriteActions: true,
          confirmedActions: pendingActions,
          skipUserEcho: true,
        },
      );
      setPendingActions([]);
    } finally {
      setConfirmingWriteActions(false);
    }
  };

  const cancelPendingActions = () => {
    setPendingActions([]);
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '## No changes made\n\nI held off on those write actions. If you want, I can revise the plan first or prepare a smaller action set.',
      },
    ]);
  };

  const aiDisabledByAdmin = decision?.allowed && usage?.ai_enabled === false;
  const aiCapReached = Boolean(usage && usage.remaining_messages <= 0);
  const inputBlocked = loading || aiDisabledByAdmin || aiCapReached;

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Premium
              </Badge>
              {profile?.role === 'planner' && profile?.planner_type === 'committee' && (
                <Badge variant="outline">Committee aware</Badge>
              )}
              {profile?.role === 'vendor' && (
                <Badge variant="outline">Vendor workspace aware</Badge>
              )}
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">{experience.name}</h1>
            <p className="max-w-3xl text-muted-foreground">{experience.subtitle}</p>
          </div>

          {profile?.role === 'planner' && selectedClient && (
            <Card className="rounded-2xl border-primary/15 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Active wedding</p>
              <p className="text-muted-foreground">
                AI actions will apply to {selectedClient.client_name}
                {selectedClient.partner_name ? ` & ${selectedClient.partner_name}` : ''}.
              </p>
            </Card>
          )}
        </div>

        {profile?.role === 'planner' && !selectedClient && decision?.allowed && (
          <Card className="rounded-2xl border-border/70 bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Planner note</p>
            <p className="text-muted-foreground">
              You can ask general questions now, but select a wedding from My Weddings if you want the assistant to make changes inside a specific client workspace.
            </p>
          </Card>
        )}

        {decision?.allowed && (
          <Card className="rounded-3xl border-border/70 p-5 shadow-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Workspace signal</p>
                <p className="text-sm text-muted-foreground">
                  {snapshotLoading
                    ? 'Scanning the current workspace so the assistant can suggest the right next moves.'
                    : workspaceSnapshot
                      ? `Tracking ${workspaceSnapshot.pendingTasks} open tasks, ${workspaceSnapshot.trackedVendors} vendors, and ${workspaceSnapshot.paymentRecords} payment records in this workspace.`
                      : 'The assistant will fall back to your default role actions until this workspace loads.'}
                </p>
              </div>
              {workspaceSnapshot && (
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <div className="rounded-2xl bg-muted/30 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.16em]">Overdue</p>
                    <p className="mt-1 font-medium text-foreground">{workspaceSnapshot.overdueTasks} tasks</p>
                  </div>
                  <div className="rounded-2xl bg-muted/30 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.16em]">Vendor gap</p>
                    <p className="mt-1 font-medium text-foreground">
                      {Math.max(workspaceSnapshot.trackedVendors - workspaceSnapshot.finalVendors, 0)} unresolved
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {experience.capabilityCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="rounded-3xl border-border/70 p-5 shadow-card">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="font-display text-xl font-semibold text-foreground">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
              </Card>
            );
          })}
        </div>

        {accessLoading ? (
          <Card className="flex items-center gap-3 rounded-3xl p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking AI access for this account...
          </Card>
        ) : !decision?.allowed ? (
          <Card className="rounded-3xl border-border/70 p-5 shadow-card">
            {decision && <InlineUpgradePrompt decision={decision} />}
          </Card>
        ) : aiDisabledByAdmin ? (
          <Card className="rounded-3xl border-amber-300/70 bg-amber-50/80 p-5 shadow-card">
            <p className="font-medium text-amber-950">AI assistant is currently disabled for this plan</p>
            <p className="mt-2 text-sm text-amber-900/80">
              An admin has temporarily switched off AI access for this audience. You can still use the rest of your Zania workspace normally.
            </p>
          </Card>
        ) : (
          <Card className="flex h-[calc(100vh-theme(spacing.36))] min-h-[28rem] flex-col overflow-hidden rounded-3xl shadow-card">
            <div className="space-y-4 border-b border-border px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">What the assistant can do</p>
                  <p className="text-sm text-muted-foreground">
                    Ask for guidance, summaries, or actions across the real parts of your Zania workspace.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm lg:min-w-72">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-foreground">Monthly AI usage</span>
                    <span className="text-muted-foreground">
                      {usageLoading
                        ? 'Loading...'
                        : usage
                          ? `${usage.messages_used}/${usage.monthly_message_cap}`
                          : 'Unavailable'}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: usage && usage.monthly_message_cap > 0
                          ? `${Math.min((usage.messages_used / usage.monthly_message_cap) * 100, 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {usage
                      ? usage.remaining_messages > 0
                        ? `${usage.remaining_messages} messages remaining this month`
                        : 'This month’s AI allowance is fully used'
                      : 'Usage resets monthly based on your active plan'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Starter actions</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {experience.starterActions.map((action) => (
                    <Button
                      key={action}
                      type="button"
                      variant="outline"
                      className="h-auto max-w-full whitespace-normal rounded-full px-4 py-2 text-left text-sm"
                      onClick={() => handleStarterAction(action)}
                      disabled={inputBlocked}
                    >
                      {action}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                      message.role === 'user'
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="max-w-none text-inherit">
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => <h1 className="mb-3 text-lg font-semibold">{children}</h1>,
                            h2: ({ children }) => <h2 className="mb-2 text-base font-semibold">{children}</h2>,
                            h3: ({ children }) => <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] opacity-80">{children}</h3>,
                            p: ({ children }) => <p className="mb-2 leading-6 last:mb-0">{children}</p>,
                            ul: ({ children }) => <ul className="mb-2 space-y-1.5 pl-5 last:mb-0">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-2 space-y-1.5 pl-5 last:mb-0">{children}</ol>,
                            li: ({ children }) => <li className="leading-6">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            code: ({ children }) => <code className="rounded bg-black/5 px-1.5 py-0.5 text-[0.92em]">{children}</code>,
                          }}
                        >
                          {formatAssistantContent(message.content)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}

              {pendingActions.length > 0 && (
                <div className="flex justify-start">
                  <Card className="max-w-[88%] rounded-3xl border-amber-300/70 bg-amber-50/80 p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-amber-950">Review these write actions before we run them</p>
                        <p className="mt-1 text-sm text-amber-900/80">
                          Nothing has been changed yet. Confirm once this looks right.
                        </p>
                        <div className="mt-3 space-y-2">
                          {pendingActions.map((action, index) => (
                            <div key={`${action.toolName}-${index}`} className="rounded-2xl border border-amber-200/80 bg-white/70 px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{action.summary}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                                    {formatActionLabel(action.toolName)}
                                  </p>
                                </div>
                                {action.destructive && (
                                  <Badge variant="destructive" className="shrink-0">Destructive</Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={runPendingActions}
                            disabled={confirmingWriteActions || loading}
                            className="gap-2"
                          >
                            {confirmingWriteActions ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            Run this action
                          </Button>
                          <Button type="button" variant="outline" onClick={cancelPendingActions} disabled={confirmingWriteActions || loading}>
                            Not yet
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-secondary px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="flex gap-2 border-t border-border p-4">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder={experience.inputPlaceholder}
                className="flex-1"
                disabled={inputBlocked}
              />
              <Button type="submit" size="icon" disabled={inputBlocked || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        )}
      </div>

      <UpgradePromptDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} decision={decision ?? null} />
    </>
  );
}
