import { createContext, useContext, useMemo, useState } from 'react';

interface AssistantLaunchRequest {
  id: number;
  prompt: string | null;
  conciergeContext: string | null;
}

interface AssistantPanelContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  launchRequest: AssistantLaunchRequest | null;
  conciergeContext: string | null;
  setConciergeContext: (context: string | null) => void;
  openAssistant: (prompt?: string | null, conciergeContext?: string | null) => void;
}

const AssistantPanelContext = createContext<AssistantPanelContextValue | null>(null);

export function AssistantPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [launchRequest, setLaunchRequest] = useState<AssistantLaunchRequest | null>(null);
  const [conciergeContext, setConciergeContext] = useState<string | null>(null);

  const value = useMemo<AssistantPanelContextValue>(
    () => ({
      open,
      setOpen,
      launchRequest,
      conciergeContext,
      setConciergeContext,
      openAssistant: (prompt?: string | null, launchConciergeContext?: string | null) => {
        setLaunchRequest({
          id: Date.now(),
          prompt: prompt?.trim() ? prompt.trim() : null,
          conciergeContext: launchConciergeContext?.trim()
            ? launchConciergeContext.trim()
            : conciergeContext?.trim()
              ? conciergeContext.trim()
              : null,
        });
        setOpen(true);
      },
    }),
    [conciergeContext, launchRequest, open],
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
