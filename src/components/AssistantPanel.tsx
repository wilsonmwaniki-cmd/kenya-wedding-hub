import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Bot, Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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

function getAssistantEyebrow(role?: string | null, plannerType?: PlannerType | null) {
  if (role === 'vendor') return 'VENDOR ASSISTANT';
  if (role === 'planner' && plannerType === 'committee') return 'COMMITTEE ASSISTANT';
  if (role === 'planner') return 'PLANNER ASSISTANT';
  return 'WEDDING ASSISTANT';
}

function getAssistantGreeting(role?: string | null, surfaceLabel?: string) {
  if (role === 'vendor') {
    return `Hello, I’m your Zania vendor assistant. I can help you tighten leads, listings, documents, and follow-ups step by step. To start, what would you like to work on in ${surfaceLabel ?? 'this workspace'}?`;
  }

  if (role === 'planner') {
    return `Hello, I’m your Zania planner assistant. I can help you spot what needs attention, prepare client work, and turn the current page into a clear next action. What should we untangle first?`;
  }

  return `Hello, I’m your Zania wedding assistant. I can help you plan this wedding step by step, from budgets and vendors to guests, tasks, and timelines. To start, what do you want help with?`;
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
  const assistantBusy = assistant.loading || assistant.usageLoading || assistant.accessLoading;
  const greeting = useMemo(() => getAssistantGreeting(role, surface.label), [role, surface.label]);
  const assistantEyebrow = useMemo(() => getAssistantEyebrow(role, plannerType), [plannerType, role]);

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
    <>
      <motion.button
        type="button"
        onClick={() => assistantPanel.setOpen(true)}
        whileHover={{ y: -2, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="fixed bottom-5 right-5 z-30 inline-flex h-12 items-center gap-2 rounded-full border border-white/30 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_44px_rgba(216,91,50,0.34)] transition-colors hover:bg-primary/95 lg:bottom-7 lg:right-7"
      >
        <Sparkles className="h-4 w-4" />
        Ask Zania
      </motion.button>

      <AnimatePresence>
        {assistantPanel.open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/22 p-3 backdrop-blur-[2px] sm:items-center sm:p-5 lg:justify-end lg:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => assistantPanel.setOpen(false)}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Ask Zania assistant"
              className="relative flex h-[min(760px,calc(100vh-1.5rem))] w-full max-w-[560px] flex-col overflow-hidden rounded-[2rem] border border-white/50 bg-[linear-gradient(145deg,rgba(115,76,57,0.76),rgba(210,160,113,0.62)_38%,rgba(44,41,37,0.72)_100%)] text-white shadow-[0_32px_90px_rgba(40,24,18,0.35)] backdrop-blur-2xl sm:h-[min(780px,calc(100vh-2.5rem))] sm:rounded-[2.25rem]"
              initial={{ opacity: 0, y: 34, scale: 0.96, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 24, scale: 0.97, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 210, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.34),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(248,240,222,0.48),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_46%,rgba(0,0,0,0.16))]" />
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/45" />

              <header className="relative border-b border-white/18 px-5 py-5 sm:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="font-display text-3xl leading-none text-white drop-shadow-sm sm:text-4xl">Ask Zania</h2>
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-white/66">
                        {assistantEyebrow}
                      </span>
                    </div>
                    <p className="mt-3 max-w-md text-sm leading-6 text-white/78 sm:text-base">
                      {surface.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => assistantPanel.setOpen(false)}
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/45 bg-white/8 text-white/80 transition-colors hover:bg-white/16 hover:text-white"
                    aria-label="Close Zania assistant"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </header>

              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
                  {assistant.decision && !assistant.canUseAssistant ? (
                    <div className="rounded-[1.5rem] border border-white/35 bg-white/82 p-4 text-foreground shadow-sm">
                      <InlineUpgradePrompt decision={assistant.decision} />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <motion.div
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 }}
                        className="rounded-[1.65rem] border border-white/68 bg-white/10 px-5 py-5 text-[1.05rem] leading-8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:px-6 sm:py-6 sm:text-xl sm:leading-9"
                      >
                        {greeting}
                      </motion.div>

                      <AnimatePresence mode="wait">
                        {assistantBusy ? (
                          <motion.div
                            key="thinking"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="flex items-center gap-3 rounded-[1.4rem] border border-white/35 bg-white/12 px-5 py-4 text-sm text-white/82"
                          >
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                            Thinking through your workspace...
                          </motion.div>
                        ) : assistant.error ? (
                          <motion.div
                            key="error"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="rounded-[1.4rem] border border-red-100/60 bg-red-950/24 px-5 py-4"
                          >
                            <p className="text-sm font-semibold text-white">Could not load AI guidance</p>
                            <p className="mt-1 text-sm leading-6 text-white/78">{assistant.error}</p>
                          </motion.div>
                        ) : assistant.response ? (
                          <motion.div
                            key="response"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="rounded-[1.4rem] border border-white/54 bg-white/90 px-5 py-4 text-foreground shadow-sm"
                          >
                            <div className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-1">
                              <ReactMarkdown>{assistant.response}</ReactMarkdown>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="empty"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="rounded-[1.4rem] border border-white/22 bg-black/8 px-5 py-4"
                          >
                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                              <MessageSquare className="h-4 w-4" />
                              Current context: {surface.label}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/72">
                              Pick a suggestion below or type your own question. Zania will read the current page context automatically.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <footer className="relative border-t border-white/18 bg-black/10 px-5 py-4 sm:px-7">
                  {!(assistant.decision && !assistant.canUseAssistant) ? (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {surface.prompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => assistant.runPrompt(prompt, { contextSource: surface.contextSource })}
                          disabled={assistantBusy}
                          className="rounded-full border border-white/70 bg-white/10 px-4 py-2 text-left text-sm leading-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-55"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="rounded-[1.45rem] border border-white/30 bg-white/10 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                    <div className="flex items-end gap-2">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-white/78">
                        <Bot className="h-5 w-5" />
                      </div>
                      <Textarea
                        value={customPrompt}
                        onChange={(event) => setCustomPrompt(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault();
                            void submitCustomPrompt();
                          }
                        }}
                        placeholder={`Ask about ${surface.label.toLowerCase()}...`}
                        className="min-h-12 flex-1 resize-none border-0 bg-transparent px-1 py-3 text-base text-white placeholder:text-white/45 focus-visible:ring-0 focus-visible:ring-offset-0"
                        disabled={assistant.decision ? !assistant.canUseAssistant : false}
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={submitCustomPrompt}
                        disabled={assistantBusy || !customPrompt.trim() || (assistant.decision ? !assistant.canUseAssistant : false)}
                        className="h-11 w-11 shrink-0 rounded-2xl bg-white text-primary shadow-none hover:bg-white/90"
                        aria-label="Ask Zania"
                      >
                        {assistant.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Button asChild variant="ghost" className="mt-3 h-auto gap-2 px-1 text-white/78 hover:bg-transparent hover:text-white">
                    <Link to="/ai-chat" onClick={() => assistantPanel.setOpen(false)}>
                      Open full assistant panel
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </footer>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
