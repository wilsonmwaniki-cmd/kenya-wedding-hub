import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useInlineAssistant } from '@/hooks/useInlineAssistant';
import type { EntitlementFeature } from '@/lib/entitlements';
import type { PlannerType } from '@/lib/roles';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';

function getAssistantFeature(role?: string | null, plannerType?: PlannerType | null): EntitlementFeature | null {
  if (role === 'admin') return null;
  if (role === 'vendor') return 'vendor.ai_assistant';
  if (role === 'planner' && plannerType === 'committee') return 'committee.ai_assistant';
  if (role === 'planner') return 'planner.ai_assistant';
  return 'couple.ai_assistant';
}

function getAssistantSurface(pathname: string, role?: string | null) {
  if (pathname.startsWith('/budget')) {
    return {
      label: 'Budget',
      page: 'budget',
      contextSource: 'assistant_panel_budget',
      title: 'Budget assistant',
      description: 'Use the current budget page context to spot pressure, rebalance spending, and prioritize payments.',
      prompts: [
        'Review this budget and tell me where pressure needs attention first.',
        'Suggest the simplest way to rebalance our wedding budget this week.',
        'Look at upcoming payments and tell me what should be paid first.',
      ],
    };
  }

  if (pathname.startsWith('/tasks')) {
    return {
      label: 'Tasks',
      page: 'tasks',
      contextSource: 'assistant_panel_tasks',
      title: 'Task assistant',
      description: 'Use the live task list to build a catch-up plan and decide what to tackle first.',
      prompts: [
        'Turn the overdue tasks into a realistic catch-up plan for this week.',
        'Tell me which task should be tackled first and why.',
        'Review the vendor-linked tasks and tell me what needs attention first.',
      ],
    };
  }

  if (pathname.startsWith('/vendors')) {
    return {
      label: 'Vendors',
      page: 'vendors',
      contextSource: 'assistant_panel_vendors',
      title: 'Vendor assistant',
      description: 'Use the vendor workspace to spot shortlist gaps, pending decisions, and payment follow-up.',
      prompts: [
        'Tell me which vendor decision needs attention first.',
        'Review the shortlist gaps and tell me what category should be closed next.',
        'Look at the vendor follow-ups and payment deadlines and tell me what matters now.',
      ],
    };
  }

  if (pathname.startsWith('/guests')) {
    return {
      label: 'Guests',
      page: 'guests',
      contextSource: 'assistant_panel_guests',
      title: 'Guest assistant',
      description: 'Get quick guidance on RSVP follow-up, guest coordination, and list cleanup.',
      prompts: [
        'Tell me what guest-list work should happen next.',
        'Help me plan the next RSVP follow-up.',
        'Review this guest workspace and tell me what needs attention first.',
      ],
    };
  }

  if (pathname.startsWith('/timeline')) {
    return {
      label: 'Timeline',
      page: 'timeline',
      contextSource: 'assistant_panel_timeline',
      title: 'Timeline assistant',
      description: 'Use the current timeline to spot weak points, missing handoffs, and what to lock down next.',
      prompts: [
        'Review this timeline and tell me what looks risky.',
        'Tell me what timeline items should be confirmed next.',
        'Help me tighten the wedding-day flow from what is already here.',
      ],
    };
  }

  if (pathname.startsWith('/clients') && role === 'planner') {
    return {
      label: 'Planner workspace',
      page: 'planner_dashboard',
      contextSource: 'assistant_panel_clients',
      title: 'Planner assistant',
      description: 'Get quick help deciding which wedding client needs attention first and what action to take.',
      prompts: [
        'Tell me which client wedding likely needs my attention first.',
        'Give me a quick planner ops checklist for today.',
        'Summarize the next best planner actions from this workspace.',
      ],
    };
  }

  if (pathname.startsWith('/vendor-dashboard') || pathname.startsWith('/vendor-settings')) {
    return {
      label: 'Vendor workspace',
      page: 'vendor_workspace',
      contextSource: 'assistant_panel_vendor',
      title: 'Vendor assistant',
      description: 'Use the vendor workspace to help with leads, bookings, listing improvements, and follow-up.',
      prompts: [
        'Tell me what vendor business action should happen next.',
        'Review this vendor workspace and suggest the strongest next move.',
        'Help me improve this vendor workflow with one practical next step.',
      ],
    };
  }

  if (pathname.startsWith('/settings')) {
    return {
      label: 'Settings',
      page: 'settings',
      contextSource: 'assistant_panel_settings',
      title: 'Workspace assistant',
      description: 'Use the current workspace state to suggest the next setup or account detail to complete.',
      prompts: [
        'Tell me what setup detail we should complete next.',
        'Review this workspace and suggest the next practical configuration step.',
        'What is missing from this setup that would unblock planning?',
      ],
    };
  }

  return {
    label: role === 'vendor' ? 'Vendor workspace' : 'Dashboard',
    page: role === 'vendor' ? 'vendor_workspace' : 'dashboard',
    contextSource: 'assistant_panel_dashboard',
    title: role === 'vendor' ? 'Vendor assistant' : 'Wedding assistant',
    description: 'Get one clear recommendation based on the page you are already on.',
    prompts: [
      'Give me the next best move from this workspace.',
      'Tell me what needs attention first right now.',
      'Summarize the most important action to take next.',
    ],
  };
}

export default function AssistantPanel({
  role,
  plannerType,
}: {
  role?: string | null;
  plannerType?: PlannerType | null;
}) {
  const location = useLocation();
  const [customPrompt, setCustomPrompt] = useState('');
  const assistantPanel = useAssistantPanel();
  const feature = useMemo(() => getAssistantFeature(role, plannerType), [plannerType, role]);
  const surface = useMemo(() => getAssistantSurface(location.pathname, role), [location.pathname, role]);

  const assistant = useInlineAssistant({
    feature: feature ?? 'couple.ai_assistant',
    page: surface.page,
    surface: 'assistant_panel',
    contextSource: surface.contextSource,
  });
  const starterPrompt = surface.prompts[0] ?? '';

  useEffect(() => {
    assistant.clearResponse();
    setCustomPrompt(starterPrompt);
  }, [location.pathname, starterPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!assistantPanel?.open) return;
    setCustomPrompt((current) => current.trim() ? current : starterPrompt);
  }, [assistantPanel?.open, starterPrompt]);

  useEffect(() => {
    if (!assistantPanel?.launchRequest) return;
    setCustomPrompt(assistantPanel.launchRequest.prompt ?? starterPrompt);
  }, [assistantPanel?.launchRequest?.id, assistantPanel?.launchRequest?.prompt, starterPrompt]);

  if (!assistantPanel || !feature || location.pathname === '/ai-chat') return null;

  const submitCustomPrompt = async () => {
    const prompt = customPrompt.trim();
    if (!prompt) return;
    await assistant.runPrompt(prompt, {
      contextSource: surface.contextSource,
      surface: 'assistant_panel_custom',
    });
  };

  return (
    <Sheet open={assistantPanel.open} onOpenChange={assistantPanel.setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          className="fixed bottom-5 right-5 z-30 h-12 rounded-full px-4 shadow-xl lg:bottom-7 lg:right-7"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Ask Zania
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <div className="flex min-h-full flex-col">
          <SheetHeader className="border-b border-border px-6 py-5 text-left">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {surface.label}
              </Badge>
            </div>
            <SheetTitle className="font-display text-2xl">{surface.title}</SheetTitle>
            <SheetDescription>{surface.description}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 px-6 py-5">
            {assistant.decision && !assistant.canUseAssistant ? (
              <InlineUpgradePrompt decision={assistant.decision} />
            ) : (
              <>
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Ask a question about this page</p>
                    {starterPrompt ? (
                      <p className="text-xs text-muted-foreground">
                        We’ve prefilled a useful starter question for this page. You can send it as-is or edit it first.
                      </p>
                    ) : null}
                  </div>
                  <Textarea
                    value={customPrompt}
                    onChange={(event) => setCustomPrompt(event.target.value)}
                    placeholder={`Ask about ${surface.label.toLowerCase()}...`}
                    className="min-h-28 resize-none bg-background"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">The assistant will use the context from this page automatically.</p>
                    <Button
                      type="button"
                      className="gap-2"
                      onClick={submitCustomPrompt}
                      disabled={assistant.loading || assistant.usageLoading || assistant.accessLoading || !customPrompt.trim()}
                    >
                      {assistant.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Ask
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Suggested prompts
                  </p>
                  <div className="grid gap-2">
                    {surface.prompts.map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
                        onClick={() => assistant.runPrompt(prompt, { contextSource: surface.contextSource })}
                        disabled={assistant.loading || assistant.usageLoading || assistant.accessLoading}
                      >
                        <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{prompt}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background p-4">
                  {assistant.loading || assistant.usageLoading || assistant.accessLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Thinking through your workspace...
                    </div>
                  ) : assistant.error ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-destructive">Could not load AI guidance</p>
                      <p className="text-sm text-muted-foreground">{assistant.error}</p>
                    </div>
                  ) : assistant.response ? (
                    <div className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-1">
                      <ReactMarkdown>{assistant.response}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Ask for one clear next step</p>
                      <p className="text-sm text-muted-foreground">
                        Use a suggested prompt or type your own question. This panel keeps the current page context so you do not have to explain everything from scratch.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="border-t border-border px-6 py-4">
            <Button asChild variant="ghost" className="gap-2">
              <Link to="/ai-chat">
                Open full assistant
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
