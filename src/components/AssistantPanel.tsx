import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Bot, Loader2, Send, X } from 'lucide-react';
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

export default function AssistantPanel({
  role,
  plannerType,
}: {
  role?: string | null;
  plannerType?: PlannerType | null;
}) {
  const location = useLocation();
  const [customPrompt, setCustomPrompt] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);
  const [animatedPrompt, setAnimatedPrompt] = useState('');
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
  const activePrompt = surface.prompts[promptIndex % Math.max(surface.prompts.length, 1)] ?? starterPrompt;
  const assistantBusy = assistant.loading || assistant.usageLoading || assistant.accessLoading;
  const assistantEyebrow = useMemo(() => getAssistantEyebrow(role, plannerType), [plannerType, role]);

  useEffect(() => {
    assistant.clearResponse();
    setCustomPrompt('');
    setPromptIndex(0);
  }, [location.pathname, starterPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!surface.prompts.length) return undefined;

    let characterIndex = 0;
    let deleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    setAnimatedPrompt('');

    const tick = () => {
      if (!deleting) {
        characterIndex += 1;
        setAnimatedPrompt(activePrompt.slice(0, characterIndex));

        if (characterIndex >= activePrompt.length) {
          deleting = true;
          timeoutId = setTimeout(tick, 1700);
          return;
        }

        timeoutId = setTimeout(tick, 34);
        return;
      }

      characterIndex -= 1;
      setAnimatedPrompt(activePrompt.slice(0, Math.max(characterIndex, 0)));

      if (characterIndex <= 0) {
        setPromptIndex((current) => (current + 1) % surface.prompts.length);
        return;
      }

      timeoutId = setTimeout(tick, 18);
    };

    timeoutId = setTimeout(tick, 260);

    return () => clearTimeout(timeoutId);
  }, [activePrompt, surface.prompts]);

  useEffect(() => {
    if (!assistantPanel?.launchRequest) return;
    setCustomPrompt(assistantPanel.launchRequest.prompt ?? '');
  }, [assistantPanel?.launchRequest?.id, assistantPanel?.launchRequest?.prompt]);

  if (!assistantPanel || !feature || location.pathname === '/ai-chat') return null;

  const submitCustomPrompt = async () => {
    const prompt = customPrompt.trim() || activePrompt.trim();
    if (!prompt) return;
    await assistant.runPrompt(prompt, {
      contextSource: surface.contextSource,
      surface: 'assistant_panel_custom',
    });
  };

  return (
    <>
      <AnimatePresence initial={false}>
        {!assistantPanel.open ? (
          <motion.button
            type="button"
            onClick={() => assistantPanel.setOpen(true)}
            initial={{ opacity: 0, y: 18, scale: 0.97, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 16, scale: 0.97, filter: 'blur(8px)' }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="fixed bottom-4 right-4 z-30 w-[calc(100vw-2rem)] max-w-[430px] overflow-hidden rounded-[2rem] border border-white/60 bg-[radial-gradient(circle_at_78%_24%,rgba(255,255,255,0.48),transparent_34%),radial-gradient(circle_at_35%_120%,rgba(239,214,182,0.40),transparent_38%),linear-gradient(135deg,rgba(111,105,94,0.76),rgba(213,185,149,0.60)_48%,rgba(120,126,101,0.72))] p-4 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_22px_58px_rgba(39,33,26,0.24)] backdrop-blur-2xl sm:max-w-[500px] sm:rounded-[2.35rem] sm:p-5 lg:bottom-6 lg:right-6"
            aria-label="Open Ask Zania assistant"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.24)_44%,transparent_64%)] opacity-70" />
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/35" />
            <div className="relative mb-3 flex items-center gap-x-3.5 sm:mb-4 sm:gap-x-4">
              <span className="shrink-0 font-display text-[1.75rem] leading-[0.9] text-white drop-shadow-sm sm:text-[2rem]">
                Ask Zania
              </span>
              <span className="min-w-0 translate-y-[1px] truncate text-[0.58rem] font-semibold uppercase tracking-[0.30em] text-white/72 sm:text-[0.66rem] sm:tracking-[0.36em]">
                {assistantEyebrow}
              </span>
            </div>
            <div className="relative flex min-h-[4.85rem] items-center gap-3 rounded-[1.55rem] border-2 border-white/70 bg-white/9 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:min-h-[5.55rem] sm:gap-4 sm:rounded-[1.9rem] sm:px-5">
              <Bot className="h-[18px] w-[18px] shrink-0 text-white/82 sm:h-5 sm:w-5" />
              <span className="min-w-0 flex-1 truncate text-lg font-medium leading-none text-white/90 sm:text-xl">
                {animatedPrompt || `Ask about ${surface.label.toLowerCase()}...`}
                <span className="ml-0.5 animate-pulse">|</span>
              </span>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/16 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] sm:h-14 sm:w-14">
                <Send className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
            </div>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {assistantPanel.open ? (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-3 sm:p-4 lg:justify-end lg:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Ask Zania assistant"
              className="pointer-events-auto relative flex w-full max-w-[500px] flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-[radial-gradient(circle_at_78%_24%,rgba(255,255,255,0.48),transparent_34%),radial-gradient(circle_at_35%_120%,rgba(239,214,182,0.40),transparent_38%),linear-gradient(135deg,rgba(111,105,94,0.76),rgba(213,185,149,0.60)_48%,rgba(120,126,101,0.72))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_24px_64px_rgba(39,33,26,0.26)] backdrop-blur-2xl sm:max-w-[560px] sm:rounded-[2.35rem]"
              initial={{ opacity: 0, y: 34, scale: 0.94, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 24, scale: 0.95, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 210, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.24)_44%,transparent_64%)] opacity-70" />
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/35" />

              <header className="relative px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-x-3.5 sm:gap-x-4">
                      <h2 className="shrink-0 font-display text-[1.9rem] leading-[0.9] text-white drop-shadow-sm sm:text-[2.2rem]">
                        Ask Zania
                      </h2>
                      <span className="min-w-0 translate-y-[1px] truncate text-[0.6rem] font-semibold uppercase tracking-[0.30em] text-white/72 sm:text-[0.68rem] sm:tracking-[0.36em]">
                        {assistantEyebrow}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => assistantPanel.setOpen(false)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/45 bg-white/9 text-white/82 transition-colors hover:bg-white/18 hover:text-white sm:h-11 sm:w-11"
                    aria-label="Close Zania assistant"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </header>

              <div className="relative flex flex-col px-4 pb-4 sm:px-6 sm:pb-5">
                <div className="rounded-[1.55rem] border-2 border-white/68 bg-white/9 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:rounded-[1.95rem] sm:p-3">
                  <div className="flex min-h-[4.4rem] items-center gap-3 sm:min-h-[5.1rem] sm:gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-white/82 sm:h-12 sm:w-12">
                      <Bot className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
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
                      placeholder={animatedPrompt ? `${animatedPrompt}|` : `Ask about ${surface.label.toLowerCase()}...`}
                      className="min-h-11 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-lg font-medium leading-7 text-white placeholder:text-white/82 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-xl sm:leading-8"
                      disabled={assistant.decision ? !assistant.canUseAssistant : false}
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={submitCustomPrompt}
                      disabled={assistantBusy || (!customPrompt.trim() && !activePrompt.trim()) || (assistant.decision ? !assistant.canUseAssistant : false)}
                      className="h-12 w-12 shrink-0 rounded-full bg-white/18 text-white shadow-none backdrop-blur hover:bg-white/28 disabled:opacity-50 sm:h-14 sm:w-14"
                      aria-label="Ask Zania"
                    >
                      {assistant.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 sm:h-6 sm:w-6" />}
                    </Button>
                  </div>
                </div>

                {!(assistant.decision && !assistant.canUseAssistant) && !assistantBusy && !assistant.error ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {surface.prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setCustomPrompt(prompt);
                          void assistant.runPrompt(prompt, { contextSource: surface.contextSource });
                        }}
                        className="rounded-full border border-white/62 bg-white/10 px-3.5 py-1.5 text-left text-xs leading-5 text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:bg-white/18 sm:px-4 sm:text-sm"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 max-h-[38vh] overflow-y-auto pr-1">
                  {assistant.decision && !assistant.canUseAssistant ? (
                    <div className="rounded-[1.5rem] border border-white/35 bg-white/82 p-4 text-foreground shadow-sm">
                      <InlineUpgradePrompt decision={assistant.decision} />
                    </div>
                  ) : (
                    <div className="space-y-5">
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
                        ) : null}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <footer className="relative mt-3">
                  <Button asChild variant="ghost" className="h-auto gap-2 px-1 py-0 text-white/78 hover:bg-transparent hover:text-white">
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
