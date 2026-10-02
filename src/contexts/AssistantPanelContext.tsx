import { createContext, useContext, useMemo, useState } from 'react';

interface AssistantLaunchRequest {
  id: number;
  prompt: string | null;
  conciergeContext: string | null;
  autoSubmit: boolean;
  actions: AssistantLaunchAction[];
}

interface AssistantLaunchAction {
  label: string;
  path: string;
}

interface AssistantLaunchOptions {
  autoSubmit?: boolean;
  actions?: AssistantLaunchAction[];
}

interface AssistantPanelContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  launchRequest: AssistantLaunchRequest | null;
  openAssistant: (
    prompt?: string | null,
    conciergeContext?: string | null,
    options?: AssistantLaunchOptions,
  ) => void;
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
      openAssistant: (
        prompt?: string | null,
        launchConciergeContext?: string | null,
        options?: AssistantLaunchOptions,
      ) => {
        setLaunchRequest({
          id: Date.now(),
          prompt: prompt?.trim() ? prompt.trim() : null,
          conciergeContext: launchConciergeContext?.trim()
            ? launchConciergeContext.trim()
            : null,
          autoSubmit: options?.autoSubmit ?? false,
          actions: options?.actions ?? [],
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
