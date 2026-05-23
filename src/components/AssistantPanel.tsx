import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [lastSubmittedPrompt, setLastSubmittedPrompt] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    assistant.clearResponse();
    setCustomPrompt('');
    setLastSubmittedPrompt('');
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

  useEffect(() => {
    if (!assistantPanel?.open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [assistantPanel?.open, assistant.response, assistant.loading, assistant.error, lastSubmittedPrompt]);

  if (!assistantPanel || !feature || location.pathname === '/ai-chat') return null;

  const runAssistantPrompt = async (promptValue: string, surfaceName = 'assistant_panel_custom') => {
    const prompt = promptValue.trim();
    if (!prompt) return;
    setLastSubmittedPrompt(prompt);
    setCustomPrompt('');
    await assistant.runPrompt(prompt, {
      contextSource: surface.contextSource,
      surface: surfaceName,
    });
  };

  const submitCustomPrompt = async () => {
    await runAssistantPrompt(customPrompt.trim() || activePrompt.trim());
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
            className="fixed bottom-4 right-4 z-30 w-[calc(100vw-2rem)] max-w-[390px] overflow-hidden rounded-[1.55rem] border border-white/[0.18] bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.34),transparent_34%),radial-gradient(circle_at_18%_115%,rgba(238,202,160,0.32),transparent_42%),linear-gradient(135deg,rgba(80,75,64,0.78),rgba(185,155,119,0.60)_50%,rgba(76,87,65,0.78))] p-3.5 text-left text-[#fff6e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_46px_rgba(49,41,33,0.22)] backdrop-blur-[24px] sm:max-w-[440px] sm:rounded-[1.75rem] sm:p-4 lg:bottom-6 lg:right-6"
            aria-label="Open Ask Zania assistant"
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,transparent,rgba(255,255,255,0.20)_42%,transparent_66%)] opacity-75" />
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.18]" />
            <div className="relative mb-2.5 flex items-baseline gap-x-3 sm:mb-3">
              <span className="shrink-0 font-display text-[1.45rem] leading-none text-[#fff6e8] drop-shadow-sm sm:text-[1.65rem]">
                Ask Zania
              </span>
              <span className="min-w-0 truncate text-[0.55rem] font-semibold uppercase tracking-[0.26em] text-[#fff6e8]/68 sm:text-[0.6rem] sm:tracking-[0.30em]">
                Planning assistant
              </span>
            </div>
            <div className="relative flex min-h-[3.7rem] items-center gap-3 rounded-[1.25rem] border border-white/45 bg-white/[0.08] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:min-h-[4.2rem] sm:rounded-[1.45rem] sm:px-4">
              <Bot className="h-[17px] w-[17px] shrink-0 text-[#fff6e8]/78 sm:h-[18px] sm:w-[18px]" />
              <span className="min-w-0 flex-1 truncate text-[0.98rem] font-medium leading-none text-[#fff6e8]/90 sm:text-[1.08rem]">
                {animatedPrompt || `Ask about ${surface.label.toLowerCase()}...`}
                <span className="ml-0.5 animate-pulse">|</span>
              </span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff6e8]/16 text-[#fff6e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] sm:h-11 sm:w-11">
                <Send className="h-[18px] w-[18px]" />
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
              className="pointer-events-auto relative flex h-[min(720px,calc(100dvh-1.25rem))] w-full max-w-[520px] flex-col overflow-hidden rounded-[1.75rem] border border-white/[0.18] bg-[radial-gradient(circle_at_78%_16%,rgba(255,255,255,0.36),transparent_32%),radial-gradient(circle_at_20%_118%,rgba(238,202,160,0.34),transparent_40%),linear-gradient(138deg,rgba(75,70,61,0.82),rgba(191,164,130,0.64)_48%,rgba(73,85,64,0.80))] text-[#fff6e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_24px_70px_rgba(43,36,29,0.26)] backdrop-blur-[24px] sm:h-[min(680px,calc(100dvh-3rem))] sm:rounded-[1.85rem]"
              initial={{ opacity: 0, y: 34, scale: 0.94, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 24, scale: 0.95, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 210, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,transparent,rgba(255,255,255,0.20)_42%,transparent_66%)] opacity-75" />
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.18]" />

              <header className="relative border-b border-white/[0.14] px-4 pb-3.5 pt-4 sm:px-5 sm:pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-x-3">
                      <h2 className="shrink-0 font-display text-[1.8rem] leading-none text-[#fff6e8] drop-shadow-sm sm:text-[2rem]">
                        Ask Zania
                      </h2>
                      <span className="min-w-0 truncate text-[0.58rem] font-semibold uppercase tracking-[0.30em] text-[#fff6e8]/68 sm:text-[0.64rem]">
                        Planning assistant
                      </span>
                    </div>
                    <p className="mt-1.5 max-w-[24rem] text-sm leading-5 text-[#fff6e8]/72">
                      Context-aware help for this page, without leaving your workspace.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => assistantPanel.setOpen(false)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.22] bg-white/[0.08] text-[#fff6e8]/82 transition-colors hover:bg-white/[0.14] hover:text-[#fff6e8]"
                    aria-label="Close Zania assistant"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </header>

              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                  {assistant.decision && !assistant.canUseAssistant ? (
                    <div className="rounded-[1.5rem] border border-white/[0.18] bg-[#fff6e8]/86 p-4 text-foreground shadow-sm">
                      <InlineUpgradePrompt decision={assistant.decision} />
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-[88%] rounded-[1.25rem] border border-white/[0.18] bg-white/[0.12] px-4 py-3 text-sm leading-6 text-[#fff6e8]/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                      >
                        Hello, I’m your Zania planning assistant. I can read this {surface.label.toLowerCase()} context and suggest the next practical move.
                      </motion.div>

                      {lastSubmittedPrompt ? (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="ml-auto max-w-[86%] rounded-[1.25rem] border border-[rgba(255,255,255,0.16)] bg-[linear-gradient(135deg,rgba(91,67,55,0.88),rgba(137,87,62,0.82))] px-4 py-3 text-sm leading-6 text-[#fff6e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
                        >
                          {lastSubmittedPrompt}
                        </motion.div>
                      ) : null}

                      <AnimatePresence mode="wait">
                        {assistantBusy ? (
                          <motion.div
                            key="thinking"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="flex max-w-[88%] items-center gap-3 rounded-[1.25rem] border border-white/[0.18] bg-white/[0.12] px-4 py-3 text-sm text-[#fff6e8]/82"
                          >
                            <Loader2 className="h-4 w-4 animate-spin text-[#fff6e8]" />
                            Thinking through your workspace...
                          </motion.div>
                        ) : assistant.error ? (
                          <motion.div
                            key="error"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="max-w-[88%] rounded-[1.25rem] border border-red-100/40 bg-red-950/26 px-4 py-3"
                          >
                            <p className="text-sm font-semibold text-[#fff6e8]">Could not load AI guidance</p>
                            <p className="mt-1 text-sm leading-6 text-[#fff6e8]/78">{assistant.error}</p>
                          </motion.div>
                        ) : assistant.response ? (
                          <motion.div
                            key="response"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="max-w-[94%] rounded-[1.25rem] border border-white/[0.18] bg-[#fff6e8]/88 px-4 py-3 text-[#241f1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.20)]"
                          >
                            <div className="prose prose-sm max-w-none text-[#241f1a] prose-p:my-2 prose-ul:my-2 prose-li:my-1">
                              <ReactMarkdown>{assistant.response}</ReactMarkdown>
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {!(assistant.decision && !assistant.canUseAssistant) && !assistantBusy && !assistant.error ? (
                  <div className="relative flex flex-wrap gap-2 border-t border-white/[0.12] px-4 py-3 sm:px-5">
                    {surface.prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void runAssistantPrompt(prompt, 'assistant_panel_suggestion')}
                        className="rounded-full border border-white/[0.28] bg-white/[0.09] px-3.5 py-1.5 text-left text-xs leading-5 text-[#fff6e8]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:bg-white/[0.15]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                ) : null}

                <footer className="relative border-t border-white/[0.14] px-4 pb-4 pt-3 sm:px-5">
                  <div className="mb-3 rounded-[1.45rem] border border-white/[0.28] bg-white/[0.08] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                    <div className="flex min-h-[3.5rem] items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.10] text-[#fff6e8]/80">
                        <Bot className="h-[18px] w-[18px]" />
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
                        className="min-h-10 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[0.98rem] font-medium leading-6 text-[#fff6e8] placeholder:text-[#fff6e8]/72 focus-visible:ring-0 focus-visible:ring-offset-0"
                        disabled={assistant.decision ? !assistant.canUseAssistant : false}
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={submitCustomPrompt}
                        disabled={assistantBusy || (!customPrompt.trim() && !activePrompt.trim()) || (assistant.decision ? !assistant.canUseAssistant : false)}
                        className="h-11 w-11 shrink-0 rounded-full bg-[#fff6e8]/18 text-[#fff6e8] shadow-none backdrop-blur hover:bg-[#fff6e8]/26 disabled:opacity-50"
                        aria-label="Ask Zania"
                      >
                        {assistant.loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
                      </Button>
                    </div>
                  </div>
                  <Button asChild variant="ghost" className="h-auto gap-2 px-1 py-0 text-[#fff6e8]/76 hover:bg-transparent hover:text-[#fff6e8]">
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
