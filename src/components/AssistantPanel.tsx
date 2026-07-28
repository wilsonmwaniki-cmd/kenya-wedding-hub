import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, Send, X } from 'lucide-react';
import SafeMarkdown from '@/components/SafeMarkdown';
import { InlineUpgradePrompt } from '@/components/UpgradePrompt';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useInlineAssistant } from '@/hooks/useInlineAssistant';
import type { AiAssistantMessage } from '@/lib/aiAssistant';
import type { EntitlementFeature } from '@/lib/entitlements';
import type { PlannerType } from '@/lib/roles';
import { useAssistantPanel } from '@/contexts/AssistantPanelContext';

function ZaniaMonogram({
  className = '',
  accentClassName = '',
}: {
  className?: string;
  accentClassName?: string;
}) {
  return (
    <span className={`relative inline-flex items-baseline font-editorial uppercase leading-none tracking-[0.16em] ${className}`}>
      <span className="font-[300]">Z</span>
      <span className={`-ml-[0.02em] inline-block scale-[1.04] font-[500] ${accentClassName}`}>A</span>
    </span>
  );
}

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
      title: 'Setup assistant',
      description: 'Get quick help finishing your profile, account details, and setup steps.',
      prompts: [
        'Tell me what setup detail to finish next.',
        'Help me complete this profile faster.',
        'What is still missing from this setup?',
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
  const [activeRequestPrompt, setActiveRequestPrompt] = useState('');
  const [conversation, setConversation] = useState<AiAssistantMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const assistantPanel = useAssistantPanel();
  const feature = useMemo(() => getAssistantFeature(role, plannerType), [plannerType, role]);
  const surface = useMemo(() => getAssistantSurface(location.pathname, role), [location.pathname, role]);
  const compactDesktopLauncher = surface.page === 'settings';
  const activeConciergeContext = assistantPanel?.launchRequest?.conciergeContext ?? null;

  const assistant = useInlineAssistant({
    feature: feature ?? 'couple.ai_assistant',
    page: surface.page,
    surface: 'assistant_panel',
    contextSource: surface.contextSource,
    initialMessages: conversation,
    conciergeContext: activeConciergeContext,
  });
  const starterPrompt = surface.prompts[0] ?? '';
  const activePrompt = surface.prompts[promptIndex % Math.max(surface.prompts.length, 1)] ?? starterPrompt;
  const assistantBusy = assistant.loading || assistant.usageLoading || assistant.accessLoading;
  const launcherPrompt = animatedPrompt || 'Ask Zania what needs attention...';
  const composerPlaceholder = surface.page === 'planner_dashboard'
    ? 'Ask about your client weddings...'
    : surface.page === 'vendor_workspace'
      ? 'Ask about your vendor workspace...'
      : 'Ask about this wedding...';

  useEffect(() => {
    assistant.clearResponse();
    setCustomPrompt('');
    setActiveRequestPrompt('');
    setConversation([]);
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

    const focusId = window.setTimeout(() => {
      inputRef.current?.focus();
      const length = inputRef.current?.value.length ?? 0;
      inputRef.current?.setSelectionRange(length, length);
    }, 140);

    return () => window.clearTimeout(focusId);
  }, [assistantPanel?.open]);

  useEffect(() => {
    if (!assistantPanel?.open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [assistantPanel?.open]);

  useEffect(() => {
    if (!assistantPanel?.open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        assistantPanel.setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assistantPanel]);

  useEffect(() => {
    if (!assistantPanel?.open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [assistantPanel?.open, activeRequestPrompt, assistant.error, assistant.loading, conversation]);

  if (!assistantPanel || !feature || location.pathname === '/ai-chat') return null;

  const runAssistantPrompt = async (promptValue: string, surfaceName = 'assistant_panel_custom') => {
    const prompt = promptValue.trim();
    if (!prompt) return;
    setActiveRequestPrompt(prompt);
    setCustomPrompt('');
    const result = await assistant.runPrompt(prompt, {
      contextSource: surface.contextSource,
      surface: surfaceName,
      conciergeContext: activeConciergeContext,
    });
    if (result) {
      setConversation((current) => [
        ...current,
        { role: 'user', content: prompt },
        { role: 'assistant', content: result },
      ]);
      setActiveRequestPrompt('');
    }
  };

  const submitCustomPrompt = async () => {
    if (!customPrompt.trim()) return;
    await runAssistantPrompt(customPrompt.trim());
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
            className={`fixed right-3 z-[35] grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-primary/30 bg-primary p-0 text-left text-primary-foreground shadow-card bottom-[calc(env(safe-area-inset-bottom)+5.1rem)] sm:bottom-[calc(env(safe-area-inset-bottom)+5.6rem)] sm:right-4 sm:block sm:h-auto sm:w-[calc(100vw-2rem)] sm:max-w-[420px] sm:rounded-2xl sm:p-3.5 lg:bottom-6 lg:right-5 ${
              compactDesktopLauncher
                ? 'lg:w-[172px] lg:max-w-[172px] lg:rounded-xl lg:px-2.5 lg:py-2'
                : 'lg:w-[232px] lg:max-w-[232px] lg:rounded-xl lg:p-2.5'
            }`}
            aria-label="Open Ask Zania assistant"
            aria-expanded={assistantPanel.open}
          >
            <div className="relative flex h-full w-full items-center justify-center sm:hidden">
              <img
                src="/assistant-badge.svg"
                alt=""
                aria-hidden="true"
                className="h-9 w-9 select-none object-contain"
              />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-success ring-2 ring-primary" />
            </div>
            <div className={`relative hidden items-center justify-between gap-3 sm:flex ${
              compactDesktopLauncher ? 'mb-2.5 sm:mb-3 lg:mb-0' : 'mb-2.5 sm:mb-3 lg:mb-1'
            }`}>
              <div className="flex items-baseline gap-x-3">
                <span className={`shrink-0 font-display leading-none text-primary-foreground ${
                  compactDesktopLauncher
                    ? 'text-[1.45rem] sm:text-[1.65rem] lg:text-[0.9rem]'
                    : 'text-[1.45rem] sm:text-[1.65rem] lg:text-[0.96rem]'
                }`}>
                  Ask Zania
                </span>
                <span className="hidden min-w-0 truncate text-[0.55rem] font-semibold uppercase tracking-[0.26em] text-primary-foreground/70 sm:block sm:text-[0.6rem] sm:tracking-[0.30em] lg:hidden">
                  Planning assistant
                </span>
              </div>
              <span className={`inline-flex items-center gap-2 font-medium text-primary-foreground/85 ${
                compactDesktopLauncher ? 'text-[0.68rem] sm:text-[0.72rem] lg:text-[0.54rem]' : 'text-[0.68rem] sm:text-[0.72rem] lg:text-[0.58rem]'
              }`}>
                <span className="h-2 w-2 rounded-full bg-success" />
                <span className="sm:inline">Ready</span>
              </span>
            </div>
            <div className={`relative hidden min-h-[3.7rem] items-center gap-3 rounded-xl border border-primary-foreground/25 bg-primary-foreground/10 px-3.5 py-2.5 sm:flex sm:min-h-[4rem] sm:px-4 ${
              compactDesktopLauncher ? 'lg:hidden' : 'lg:min-h-[2.45rem] lg:gap-1.5 lg:px-2 lg:py-1.5'
            }`}>
              <span className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border border-primary-foreground/25 text-primary-foreground/80 sm:h-[18px] sm:w-[18px] lg:h-[12px] lg:w-[12px]">
                <ZaniaMonogram className="text-[0.4rem] sm:text-[0.42rem] lg:text-[0.28rem]" accentClassName="text-accent" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[0.98rem] font-medium leading-none text-primary-foreground/90 sm:text-[1.03rem] lg:text-[0.72rem]">
                {launcherPrompt}
                <span className="ml-0.5 animate-pulse">|</span>
              </span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-foreground/15 text-primary-foreground sm:h-10 sm:w-10 lg:h-7 lg:w-7">
                <Send className="h-[18px] w-[18px] lg:h-[12px] lg:w-[12px]" />
              </span>
            </div>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {assistantPanel.open ? (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-4 lg:justify-end lg:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => assistantPanel.setOpen(false)}
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Ask Zania assistant"
              className="pointer-events-auto relative flex h-[min(620px,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-0.75rem))] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-elevated sm:h-[min(620px,calc(100dvh-3rem))] sm:max-w-[500px] sm:rounded-3xl"
              initial={{ opacity: 0, y: 34, scale: 0.94, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 24, scale: 0.95, filter: 'blur(8px)' }}
              transition={{ type: 'spring', stiffness: 210, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative flex justify-center pt-2 sm:hidden">
                <span className="h-1 w-10 rounded-full bg-muted" />
              </div>

              <header className="relative border-b border-border bg-card px-3.5 pb-3 pt-3 sm:px-5 sm:pt-[1.125rem]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-x-3">
                      <h2 className="shrink-0 font-display text-[1.5rem] leading-none text-foreground sm:text-[1.8rem]">
                        Ask Zania
                      </h2>
                      <span className="hidden min-w-0 truncate text-[0.64rem] font-semibold uppercase tracking-[0.30em] text-muted-foreground sm:inline">
                        Planning assistant
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[0.8rem] text-muted-foreground sm:text-[0.85rem]">
                      <span className="h-2 w-2 rounded-full bg-success" />
                      Ready to help
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => assistantPanel.setOpen(false)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-10 sm:w-10"
                    aria-label="Close Zania assistant"
                  >
                    <X className="h-[18px] w-[18px]" />
                  </button>
                </div>
              </header>

              <div className="relative flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4">
                  {assistant.decision && !assistant.canUseAssistant ? (
                    <div className="rounded-2xl border border-border bg-card p-4 text-foreground shadow-card">
                      <InlineUpgradePrompt decision={assistant.decision} />
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="semantic-surface-info max-w-[94%] rounded-2xl border px-3.5 py-3 text-sm font-medium leading-6 text-foreground sm:max-w-[92%] sm:px-4 sm:py-3.5"
                      >
                        Hi, I'm your planning assistant. What would you like help with?
                      </motion.div>

                      {conversation.map((message, index) => (
                        <motion.div
                          key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={
                            message.role === 'user'
                              ? 'ml-auto max-w-[86%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm font-medium leading-6 text-primary-foreground'
                              : 'semantic-surface-info max-w-[94%] rounded-2xl rounded-bl-sm border px-4 py-3 text-foreground'
                          }
                        >
                          {message.role === 'assistant' ? (
                            <div className="prose prose-sm max-w-none text-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-1">
                              <SafeMarkdown>{message.content}</SafeMarkdown>
                            </div>
                          ) : (
                            message.content
                          )}
                        </motion.div>
                      ))}

                      {activeRequestPrompt ? (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="ml-auto max-w-[86%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm font-medium leading-6 text-primary-foreground"
                        >
                          {activeRequestPrompt}
                        </motion.div>
                      ) : null}

                      <AnimatePresence mode="wait">
                        {assistantBusy ? (
                          <motion.div
                            key="thinking"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="semantic-surface-info flex max-w-[88%] items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium text-foreground"
                          >
                            <Loader2 className="h-4 w-4 animate-spin text-info" />
                            Thinking through your workspace...
                          </motion.div>
                        ) : assistant.error ? (
                          <motion.div
                            key="error"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="semantic-surface-danger max-w-[88%] rounded-2xl border px-4 py-3"
                          >
                            <p className="text-sm font-semibold text-destructive">Could not load AI guidance</p>
                            <p className="mt-1 text-sm leading-6 text-foreground/75">{assistant.error}</p>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                {!(assistant.decision && !assistant.canUseAssistant) && !assistantBusy && !assistant.error ? (
                  <div className="relative border-t border-border bg-card/50 px-3.5 py-2.5 sm:px-5 sm:py-3">
                    <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
                      {surface.prompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void runAssistantPrompt(prompt, 'assistant_panel_suggestion')}
                          className="min-w-[13rem] rounded-xl border border-border bg-background px-3 py-2 text-left text-[0.72rem] font-medium leading-5 text-foreground transition hover:border-primary/35 hover:bg-muted/50 sm:min-w-0 sm:flex-1"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <footer className="relative border-t border-border bg-card px-3.5 pb-3 pt-2.5 sm:px-5 sm:pb-4 sm:pt-3">
                  <div className="mb-2.5 rounded-xl border border-input bg-background px-2.5 py-1.5 sm:mb-3 sm:rounded-2xl sm:p-2">
                    <div className="flex min-h-12 items-center gap-2 sm:min-h-[3.5rem] sm:gap-3">
                      <div className="hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary sm:grid">
                        <ZaniaMonogram className="text-[0.72rem]" accentClassName="text-accent" />
                      </div>
                      <Textarea
                        ref={inputRef}
                        value={customPrompt}
                        onChange={(event) => setCustomPrompt(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            event.preventDefault();
                            void submitCustomPrompt();
                          }
                        }}
                        placeholder={composerPlaceholder}
                        rows={1}
                        className="h-12 min-h-12 max-h-24 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-0 py-3 text-[0.92rem] font-medium leading-6 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                        disabled={assistant.decision ? !assistant.canUseAssistant : false}
                      />
                      <Button
                        type="button"
                        size="icon"
                        onClick={submitCustomPrompt}
                        disabled={assistantBusy || !customPrompt.trim() || (assistant.decision ? !assistant.canUseAssistant : false)}
                        className="h-9 w-9 shrink-0 rounded-full disabled:opacity-50 sm:h-10 sm:w-10"
                        aria-label="Ask Zania"
                      >
                        {assistant.loading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
                      </Button>
                    </div>
                  </div>
                  <Button asChild variant="ghost" className="h-auto gap-2 px-1 py-0 text-muted-foreground hover:bg-transparent hover:text-foreground">
                    <Link to="/ai-chat" onClick={() => assistantPanel.setOpen(false)}>
                      Open full assistant
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
