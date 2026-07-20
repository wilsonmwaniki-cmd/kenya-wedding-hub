import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface AssistantLaunchRequest {
  id: number;
  prompt: string | null;
  conciergeContext: string | null;
}

interface AssistantPanelContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  launchRequest: AssistantLaunchRequest | null;
  pageConciergeContext: string | null;
  setPageConciergeContext: (context: string | null) => void;
  openAssistant: (prompt?: string | null, conciergeContext?: string | null) => void;
}

const AssistantPanelContext = createContext<AssistantPanelContextValue | null>(null);

export function AssistantPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [launchRequest, setLaunchRequest] = useState<AssistantLaunchRequest | null>(null);
  const [pageConciergeContext, setPageConciergeContext] = useState<string | null>(null);

  const value = useMemo<AssistantPanelContextValue>(
    () => ({
      open,
      setOpen,
      launchRequest,
      pageConciergeContext,
      setPageConciergeContext,
      openAssistant: (prompt?: string | null, launchConciergeContext?: string | null) => {
        setLaunchRequest({
          id: Date.now(),
          prompt: prompt?.trim() ? prompt.trim() : null,
          conciergeContext: launchConciergeContext?.trim()
            ? launchConciergeContext.trim()
            : null,
        });
        setOpen(true);
      },
    }),
    [launchRequest, open, pageConciergeContext],
  );

  return (
    <AssistantPanelContext.Provider value={value}>
      {children}
    </AssistantPanelContext.Provider>
  );
}

export function useAssistantPanel() {
  return useContext(AssistantPanelContext);
}

export function useAssistantPageContext(conciergeContext: string | null | undefined) {
  const assistantPanel = useAssistantPanel();
  const setPageConciergeContext = assistantPanel?.setPageConciergeContext;

  useEffect(() => {
    if (!setPageConciergeContext) return;
    const normalized = conciergeContext?.trim() || null;
    setPageConciergeContext(normalized);
    return () => setPageConciergeContext(null);
  }, [conciergeContext, setPageConciergeContext]);
}
