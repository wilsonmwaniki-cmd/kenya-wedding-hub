import { createContext, useContext, useMemo, useState } from 'react';

interface AssistantLaunchRequest {
  id: number;
  prompt: string | null;
}

interface AssistantPanelContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  launchRequest: AssistantLaunchRequest | null;
  openAssistant: (prompt?: string | null) => void;
}

const AssistantPanelContext = createContext<AssistantPanelContextValue | null>(null);

export function AssistantPanelProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [launchRequest, setLaunchRequest] = useState<AssistantLaunchRequest | null>(null);

  const value = useMemo<AssistantPanelContextValue>(
    () => ({
      open,
      setOpen,
      launchRequest,
      openAssistant: (prompt?: string | null) => {
        setLaunchRequest({
          id: Date.now(),
          prompt: prompt?.trim() ? prompt.trim() : null,
        });
        setOpen(true);
      },
    }),
    [launchRequest, open],
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
