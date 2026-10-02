import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  exitDemoSession,
  getCurrentDemoSession,
  isAnonymousDemoUser,
  resetDemoSession,
  type DemoSession,
} from '@/lib/demoSessions';

type DemoSessionContextValue = {
  session: DemoSession | null;
  isDemo: boolean;
  loading: boolean;
  reset: () => Promise<void>;
  exit: () => Promise<void>;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const anonymous = isAnonymousDemoUser(user);
  const query = useQuery({
    queryKey: ['demo-session', user?.id],
    queryFn: getCurrentDemoSession,
    enabled: Boolean(user && anonymous),
    staleTime: 60_000,
    retry: false,
  });
  const session = query.data?.status === 'active' ? query.data : null;

  useEffect(() => {
    if (!query.data || query.data.status === 'active') return;
    void exitDemoSession().finally(() => window.location.assign('/explore'));
  }, [query.data]);

  const reset = async () => {
    const next = await resetDemoSession();
    queryClient.clear();
    window.location.assign(next.destinationPath);
  };

  const exit = async () => {
    await exitDemoSession();
    queryClient.clear();
    window.location.assign('/explore');
  };

  return (
    <DemoSessionContext.Provider value={{
      session,
      isDemo: Boolean(session),
      loading: anonymous && query.isPending,
      reset,
      exit,
    }}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession() {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error('useDemoSession must be used within DemoSessionProvider');
  return context;
}

export function useOptionalDemoSession() {
  return useContext(DemoSessionContext);
}
