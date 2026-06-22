import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

interface AssistantLaunchRequest {
  id: number;
  prompt: string | null;
  conciergeContext: string | null;
}

interface AssistantPanelContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  launchRequest: AssistantLaunchRequest | null;
  getConciergeContext: () => string | null;
  setConciergeContext: (context: string | null) => void;
  openAssistant: (prompt?: string | null, conciergeContext?: string | null) => void;
}

const AssistantPanelContext = createContext<AssistantPanelContextValue | null>(null);

export function AssistantPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [launchRequest, setLaunchRequest] = useState<AssistantLaunchRequest | null>(null);
  const conciergeContextRef = useRef<string | null>(null);

  const getConciergeContext = useCallback(() => conciergeContextRef.current, []);
  const setConciergeContext = useCallback((context: string | null) => {
    conciergeContextRef.current = context?.trim() ? context.trim() : null;
  }, []);

  const value = useMemo<AssistantPanelContextValue>(
    () => ({
      open,
      setOpen,
      launchRequest,
      getConciergeContext,
      setConciergeContext,
      openAssistant: (prompt?: string | null, launchConciergeContext?: string | null) => {
        const currentConciergeContext = getConciergeContext();
        setLaunchRequest({
          id: Date.now(),
          prompt: prompt?.trim() ? prompt.trim() : null,
          conciergeContext: launchConciergeContext?.trim()
            ? launchConciergeContext.trim()
            : currentConciergeContext?.trim()
              ? currentConciergeContext.trim()
              : null,
        });
        setOpen(true);
      },
    }),
    [getConciergeContext, launchRequest, open, setConciergeContext],
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
