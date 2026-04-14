import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Loader2, Send, Sparkles, Wand2, Wallet, CalendarClock, Users, Store, BriefcaseBusiness, CheckSquare2, BellRing } from 'lucide-react';
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

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wedding-ai-chat`;

function getAssistantFeature(profileRole?: string | null, plannerType?: string | null): EntitlementFeature {
  if (profileRole === 'vendor') return 'vendor.ai_assistant';
  if (profileRole === 'planner' && plannerType === 'committee') return 'committee.ai_assistant';
  if (profileRole === 'planner') return 'planner.ai_assistant';
  return 'couple.ai_assistant';
}

function getAssistantExperience(
  role?: string | null,
  plannerType?: string | null,
  selectedClientName?: string | null,
): AssistantExperience {
  if (role === 'vendor') {
    return {
      name: 'Vendor Sales & Booking Assistant',
      subtitle: 'Helps you stay on top of bookings, follow-ups, internal notes, and booking status updates.',
      intro:
        "Habari! I'm your premium vendor sales and booking assistant. I can review your booking pipeline, suggest next actions, save private internal notes, create follow-up reminders, and update booking statuses inside Zania.",
      inputPlaceholder: "Try: 'Review my open bookings and create a follow-up reminder for the next couple I should call'",
      starterActions: [
        'Review my open bookings and tell me which ones need follow-up first.',
        'Create a follow-up reminder for the next booking that needs a callback.',
        'Help me update a booking status after a client conversation.',
      ],
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
    return {
      name: 'Committee Delegation Assistant',
      subtitle: 'Keeps committee-led weddings organized around delegation, accountability, vendors, and execution.',
      intro:
        "Habari! I'm your premium committee delegation assistant. I can help your team coordinate vendors, budgets, tasks, timelines, and delegated responsibilities across the wedding workspace.",
      inputPlaceholder: "Try: 'What should the committee delegate next and which deadlines look risky?'",
      starterActions: [
        'What should the committee delegate next this month?',
        'Summarize overdue tasks, vendor follow-ups, and payment risks.',
        'Create a committee action list for the next two weeks.',
      ],
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
    return {
      name: 'Planner Operations Copilot',
      subtitle: 'Built for fast client operations across tasks, budgets, vendors, payments, and timelines.',
      intro:
        "Habari! I'm your premium planner operations copilot. I can reason across client tasks, budgets, vendors, payments, guests, and timelines, and I can take planning actions inside the selected wedding workspace.",
      inputPlaceholder:
        selectedClientName
          ? `Try: 'Summarize blockers for ${selectedClientName} and turn the next week into actions'`
          : "Try: 'Give me a planner-level summary of the biggest risks and next actions'",
      starterActions: [
        selectedClientName
          ? `Summarize blockers for ${selectedClientName} and tell me what I should handle next.`
          : 'Summarize the biggest blockers in my active wedding workspace.',
        'Create a next-7-days action plan for this wedding.',
        'Review vendor, payment, and timeline risks for me.',
      ],
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

  return {
    name: 'Couple Planning Coach',
    subtitle: 'A calm, workspace-aware wedding coach that can guide and act inside your real plan.',
    intro:
      "Habari! I'm your premium couple planning coach. I can advise you using your real Zania data and help manage tasks, vendors, guests, payments, budget, and timelines for your wedding.",
    inputPlaceholder: "Try: 'What should we focus on next this month, and what should we spend time on first?'",
    starterActions: [
      'What should we focus on next this month?',
      'Review my budget and tell me where I might be overspending.',
      'Turn my next vendor decisions into concrete tasks.',
    ],
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
  const { isPlanner, selectedClient } = usePlanner();
  const [vendorListing, setVendorListing] = useState<VendorListingAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<AiUsageStatus | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
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
    () => getAssistantExperience(profile?.role, profile?.planner_type, selectedClient?.client_name ?? null),
    [profile?.planner_type, profile?.role, selectedClient?.client_name],
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

  const sendMessage = async (nextInput: string) => {
    if (!nextInput.trim() || loading) return;

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

    const userMsg: Message = { role: 'user', content: nextInput.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: updatedMessages.map((message) => ({ role: message.role, content: message.content })),
          selectedClientId: isPlanner ? selectedClient?.id ?? null : null,
        }),
      });

      if (!resp.ok) {
        const rawError = await resp.text();
        const err = (() => {
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
            if (rawError.trim()) {
              return { error: rawError.trim() };
            }

            if (resp.status >= 500) {
              return {
                error:
                  'The AI function returned a server error. If this is a new Supabase project, confirm the LOVABLE_API_KEY secret is set for the wedding-ai-chat function.',
              };
            }

            return { error: 'Request failed' };
          }
        })();
        if (err.usage) {
          setUsage(err.usage as AiUsageStatus);
        }

        if (resp.status === 402 || resp.status === 403) {
          setUpgradeOpen(true);
        }

        toast({
          title:
            resp.status === 402
              ? 'Premium feature'
              : resp.status === 429
                ? 'Monthly AI limit reached'
                : 'AI Error',
          description: err.error || err.message || err.details || 'Something went wrong',
          variant: 'destructive',
        });
        return;
      }

      const data = await resp.json();
      const content = data.content || 'Sorry, I could not generate a response.';
      if (data.usage) {
        setUsage(data.usage as AiUsageStatus);
      }
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
                      <div className="prose prose-sm max-w-none text-inherit">
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))}

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
